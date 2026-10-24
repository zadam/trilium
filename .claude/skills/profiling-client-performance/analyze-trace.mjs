#!/usr/bin/env node
/**
 * Analyzes a Chrome DevTools performance trace (Performance panel -> download, `.json` or
 * `.json.gz`) recorded from Trilium's client, desktop app included.
 *
 * Use it to find *which subsystem* is burning the main thread before instrumenting anything. It
 * reads a production build just as well as a dev one, which `debug_perf` cannot: no source changes,
 * no rebuild, and it works on a trace someone else recorded.
 *
 *   node analyze-trace.mjs <trace> [summary|profile|spikes|timeline|phases] [options]
 *
 * `phases` splits the renderer main thread at the page's `performance.mark()` calls and reports
 * each window's busy time by kind (script, compile, style, layout, ...) and its script self time by
 * source module. `--maps <dir>` resolves frames through the build's `.map` files; `--marks <prefix>`
 * keeps only the marks whose name starts with the prefix.
 *
 * A 90 MB trace needs a bigger heap than the default:
 *   node --max-old-space-size=8192 analyze-trace.mjs trace.json profile
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

const [ , , tracePath, command = "summary", ...rest ] = process.argv;

if (!tracePath) {
    console.error("usage: analyze-trace.mjs <trace.json|.json.gz> [summary|profile|spikes|timeline|phases]");
    process.exit(1);
}

const events = loadTrace(tracePath);
const threads = describeThreads(events);
const renderer = pickBusiestRenderer(events, threads);

switch (command) {
    case "summary": summary(); break;
    case "profile": profile(numeric(rest, 25)); break;
    case "spikes": spikes(numeric(rest, 150)); break;
    case "timeline": timeline(numeric(rest, 100)); break;
    case "phases": phases(option(rest, "--maps"), option(rest, "--marks")); break;
    default:
        console.error(`unknown command "${command}"`);
        process.exit(1);
}

function loadTrace(path) {
    const raw = readFileSync(path);
    const text = path.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
    const parsed = JSON.parse(text);

    return Array.isArray(parsed) ? parsed : parsed.traceEvents;
}

/** Process and thread names, so a pid/tid can be reported as "Renderer / CrRendererMain". */
function describeThreads(events) {
    const processNames = new Map();
    const threadNames = new Map();

    for (const e of events) {
        if (e.name === "process_name") processNames.set(e.pid, e.args?.name);
        if (e.name === "thread_name") threadNames.set(`${e.pid}/${e.tid}`, e.args?.name);
    }

    return { processNames, threadNames, describe: (pid, tid) => `${processNames.get(pid) ?? "?"} / ${threadNames.get(`${pid}/${tid}`) ?? "?"}` };
}

/**
 * The top-level tasks of every thread. `RunTask` is recorded only under the
 * `disabled-by-default-devtools.timeline` category, which the Performance panel enables; a trace
 * recorded without it still has the scheduler's `ThreadControllerImpl::RunTask`, which wraps it.
 */
function runTasks(events) {
    const name = events.some((e) => e.name === "RunTask") ? "RunTask" : "ThreadControllerImpl::RunTask";
    return events.filter((e) => e.ph === "X" && e.name === name && e.dur > 0);
}

/**
 * The renderer's main thread, which is where client work lands.
 *
 * Picked by busy time among threads named CrRendererMain rather than by raw busy time overall: the
 * GPU process's vsync thread is busy for the entire trace by design and would always win.
 */
function pickBusiestRenderer(events, { threadNames }) {
    const busy = new Map();

    for (const task of runTasks(events)) {
        const key = `${task.pid}/${task.tid}`;
        if (threadNames.get(key) !== "CrRendererMain") continue;
        busy.set(key, (busy.get(key) ?? 0) + task.dur);
    }

    const [ key ] = [ ...busy.entries() ].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (!key) return null;

    const [ pid, tid ] = key.split("/").map(Number);
    return { pid, tid, busyUs: busy.get(key) };
}

function summary() {
    const tasks = runTasks(events);
    const start = Math.min(...tasks.map((t) => t.ts));
    const end = Math.max(...tasks.map((t) => t.ts + t.dur));

    console.log(`trace span: ${((end - start) / 1e6).toFixed(1)}s over ${events.length} events\n`);

    const busy = new Map();
    for (const task of tasks) {
        const key = `${task.pid}/${task.tid}`;
        busy.set(key, (busy.get(key) ?? 0) + task.dur);
    }

    console.log("=== busy time per thread ===");
    for (const [ key, dur ] of [ ...busy.entries() ].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
        const [ pid, tid ] = key.split("/").map(Number);
        console.log(`${(dur / 1000).toFixed(0).padStart(8)}ms  ${threads.describe(pid, tid)}`);
    }

    if (!renderer) {
        console.log("\nNo CrRendererMain thread found.");
        return;
    }

    const share = (renderer.busyUs / (end - start)) * 100;
    console.log(`\nrenderer main thread ${(renderer.busyUs / 1000).toFixed(0)}ms busy (${share.toFixed(0)}% of the trace)`);
    if (share > 60) {
        console.log("  Saturated. Individual stall durations conflate whatever fell inside one busy period.");
    }

    reportLongTasks(tasks, start);
}

/**
 * Long tasks with the gap from the previous one, which is what exposes a recurring beat: a steady
 * gap points at a timer or a debounce, an erratic one at something the user is driving.
 */
function reportLongTasks(tasks, start) {
    const long = tasks
        .filter((t) => t.pid === renderer.pid && t.tid === renderer.tid && t.dur > 50000)
        .sort((a, b) => a.ts - b.ts);

    console.log(`\n=== ${long.length} tasks over 50ms ===`);
    long.slice(0, 40).forEach((task, index) => {
        const gap = index ? `${((task.ts - long[index - 1].ts) / 1000).toFixed(0)}ms` : "-";
        console.log(`  @${((task.ts - start) / 1000).toFixed(0).padStart(7)}ms  ${(task.dur / 1000).toFixed(0).padStart(5)}ms   gap ${gap}`);
    });
}

/**
 * Reconstructs the renderer's V8 sampling profile from its Profile/ProfileChunk events.
 *
 * Keyed on pid *and* id: every process numbers its profiles from the same sequence, so keying on id
 * alone silently merges the browser process's profile into the renderer's and attributes main-process
 * frames to page code. Within the renderer, each thread running script (the main thread and every
 * worker) has a profile of its own; only the `Profile` event names the thread, since its chunks are
 * emitted from the sampler's thread, so the ids are taken from there.
 */
function buildProfile(pid, tid) {
    const profile = { nodes: new Map(), samples: [], deltas: [], startTime: 0 };
    const ids = new Set(events
        .filter((e) => e.pid === pid && e.tid === tid && e.name === "Profile")
        .map((e) => e.id));

    for (const e of events) {
        if (e.pid !== pid || !ids.has(e.id)) continue;

        if (e.name === "Profile" && e.args?.data) {
            profile.startTime = e.args.data.startTime;
        } else if (e.name === "ProfileChunk" && e.args?.data) {
            const cpuProfile = e.args.data.cpuProfile ?? {};
            for (const node of cpuProfile.nodes ?? []) profile.nodes.set(node.id, node);
            profile.samples.push(...(cpuProfile.samples ?? []));
            profile.deltas.push(...(e.args.data.timeDeltas ?? []));
        }
    }

    const parents = new Map();
    for (const [ id, node ] of profile.nodes) {
        if (node.parent != null) parents.set(id, node.parent);
        for (const child of node.children ?? []) if (!parents.has(child)) parents.set(child, id);
    }

    const label = (id) => {
        const frame = profile.nodes.get(id)?.callFrame;
        if (!frame) return "?";
        return `${frame.functionName || "(anon)"} @ ${(frame.url ?? "").split("/").pop()}:${frame.lineNumber + 1}`;
    };

    return { ...profile, parents, label, stackOf: (id) => {
        const stack = [];
        for (let cur = id, guard = 0; cur != null && guard < 60; cur = parents.get(cur), guard++) stack.push(label(cur));
        return stack;
    } };
}

/** Walks the profile once, yielding [timestampUs, nodeId, durationUs] per sample. */
function* walkSamples(profile) {
    let ts = profile.startTime;
    for (let i = 0; i < profile.samples.length; i++) {
        ts += profile.deltas[i] ?? 0;
        yield [ ts, profile.samples[i], profile.deltas[i] ?? 0 ];
    }
}

function profile(topN) {
    const profile = buildProfile(renderer.pid, renderer.tid);
    if (!profile.samples.length) {
        console.log("No CPU profile in this trace. Record with the Performance panel's default settings.");
        return;
    }

    console.log(`renderer profile: ${profile.samples.length} samples, ${profile.nodes.size} nodes\n`);

    const self = new Map();
    for (const [ , id, dur ] of walkSamples(profile)) self.set(id, (self.get(id) ?? 0) + dur);

    const ranked = [ ...self.entries() ].sort((a, b) => b[1] - a[1]);

    console.log("=== self time (where the CPU actually was) ===");
    for (const [ id, dur ] of ranked.slice(0, topN)) {
        console.log(`${(dur / 1000).toFixed(1).padStart(9)}ms  ${profile.label(id)}`);
    }

    // Total time folds each sample into every distinct frame above it, so a dispatcher that is never
    // itself on-CPU still shows the cost of everything it calls.
    const total = new Map();
    for (const [ id, dur ] of self) {
        for (const frame of new Set(profile.stackOf(id))) total.set(frame, (total.get(frame) ?? 0) + dur);
    }

    console.log("\n=== total time (self plus everything called) ===");
    for (const [ frame, dur ] of [ ...total.entries() ].sort((a, b) => b[1] - a[1]).slice(0, topN)) {
        console.log(`${(dur / 1000).toFixed(1).padStart(9)}ms  ${frame}`);
    }

    console.log("\n=== stacks of the heaviest frames ===");
    for (const [ id, dur ] of ranked.slice(0, 5)) {
        console.log(`\n  ${(dur / 1000).toFixed(1)}ms self`);
        for (const frame of profile.stackOf(id).slice(0, 18)) console.log(`      ${frame}`);
    }
}

/** Aggregates self time inside the long tasks only, which is what a stutter is made of. */
function spikes(thresholdMs) {
    const profile = buildProfile(renderer.pid, renderer.tid);
    const tasks = runTasks(events)
        .filter((t) => t.pid === renderer.pid && t.tid === renderer.tid && t.dur > thresholdMs * 1000);

    if (!tasks.length) {
        console.log(`No tasks over ${thresholdMs}ms on the renderer main thread.`);
        return;
    }

    const inside = (ts) => tasks.some((t) => ts >= t.ts && ts <= t.ts + t.dur);
    const self = new Map();
    const stacks = new Map();
    let sampled = 0;

    for (const [ ts, id, dur ] of walkSamples(profile)) {
        if (!inside(ts)) continue;
        sampled += dur;
        const frame = profile.label(id);
        self.set(frame, (self.get(frame) ?? 0) + dur);
        if (!stacks.has(frame)) stacks.set(frame, profile.stackOf(id));
    }

    console.log(`=== inside ${tasks.length} tasks over ${thresholdMs}ms (${(sampled / 1000).toFixed(0)}ms sampled) ===`);
    for (const [ frame, dur ] of [ ...self.entries() ].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
        console.log(`\n${(dur / 1000).toFixed(1)}ms  ${frame}`);
        for (const parent of stacks.get(frame).slice(1, 12)) console.log(`      ${parent}`);
    }
}

function timeline(bucketMs) {
    const tasks = runTasks(events).filter((t) => t.pid === renderer.pid && t.tid === renderer.tid);
    const start = Math.min(...tasks.map((t) => t.ts));
    const bucketUs = bucketMs * 1000;
    const buckets = new Map();

    for (const task of tasks) {
        const bucket = Math.floor((task.ts - start) / bucketUs);
        buckets.set(bucket, (buckets.get(bucket) ?? 0) + task.dur);
    }

    console.log(`=== renderer main thread, ${bucketMs}ms buckets (one # = ${(bucketMs / 30).toFixed(1)}ms busy) ===`);
    for (let i = 0; i <= Math.max(...buckets.keys()); i++) {
        const ms = (buckets.get(i) ?? 0) / 1000;
        const bar = "#".repeat(Math.min(60, Math.round(ms / (bucketMs / 30))));
        console.log(`${((i * bucketMs) / 1000).toFixed(1).padStart(7)}s ${String(Math.round(ms)).padStart(4)}ms ${bar}`);
    }
}

/**
 * Main-thread time between consecutive `performance.mark()` calls, split by what the thread was
 * doing and, for script, by the source module the CPU was in.
 *
 * Trace events nest (`RunTask` > `FunctionCall` > `v8.compileModule`), so each event is charged its
 * self time only, and the kind comes from the event's name.
 */
function phases(mapsDir, markPrefix) {
    const marks = events
        // `performance.mark()` records an instant ("I"); the navigation timing marks are "R".
        .filter((e) => e.pid === renderer.pid && e.cat?.includes("blink.user_timing") && e.ph === "I"
            && (!markPrefix || e.name.startsWith(markPrefix)))
        .sort((a, b) => a.ts - b.ts);
    if (marks.length < 2) {
        console.log("Fewer than two performance.mark() calls on the renderer: nothing to split at.");
        return;
    }

    const windows = marks.slice(0, -1).map((mark, index) => ({
        name: `${mark.name} -> ${marks[index + 1].name}`,
        start: mark.ts,
        end: marks[index + 1].ts,
        kinds: new Map(),
        modules: new Map()
    }));
    const windowAt = (ts) => windows.find((w) => ts >= w.start && ts < w.end);

    for (const [ event, selfUs ] of selfTimes(renderer.pid, renderer.tid)) {
        const window = windowAt(event.ts);
        if (!window) continue;
        const kind = kindOf(event.name);
        window.kinds.set(kind, (window.kinds.get(kind) ?? 0) + selfUs);
    }

    const profile = buildProfile(renderer.pid, renderer.tid);
    const resolver = createSourceResolver(mapsDir);
    for (const [ ts, id, dur ] of walkSamples(profile)) {
        const window = windowAt(ts);
        if (!window) continue;
        const module = moduleOf(profile, id, resolver);
        window.modules.set(module, (window.modules.get(module) ?? 0) + dur);
    }

    for (const window of windows) {
        const wallMs = (window.end - window.start) / 1000;
        const busyMs = [ ...window.kinds.values() ].reduce((sum, us) => sum + us, 0) / 1000;
        console.log(`\n=== ${window.name}: ${wallMs.toFixed(0)}ms wall, ${busyMs.toFixed(0)}ms main-thread busy ===`);
        const kinds = [ ...window.kinds.entries() ].sort((a, b) => b[1] - a[1]);
        console.log("  " + kinds.map(([ kind, us ]) => `${kind} ${(us / 1000).toFixed(0)}ms`).join(", "));
        for (const [ module, us ] of [ ...window.modules.entries() ].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
            if (us < 2000) break;
            console.log(`${(us / 1000).toFixed(1).padStart(9)}ms  ${module}`);
        }
    }
}

/**
 * The module a sample is charged to: its own frame's, or for a native frame (a DOM call, a
 * built-in) the nearest caller's that has a script URL. A sample with no script anywhere on its
 * stack keeps its V8 name, such as `(program)` or `(garbage collector)`.
 */
function moduleOf(profile, id, resolver) {
    for (let cur = id, guard = 0; cur != null && guard < 200; cur = profile.parents.get(cur), guard++) {
        const frame = profile.nodes.get(cur)?.callFrame;
        if (frame?.url) return resolver(frame.url, frame.lineNumber, frame.columnNumber);
    }
    return profile.nodes.get(id)?.callFrame?.functionName || "(unknown)";
}

/** Yields each complete event on one thread with its self time: its duration minus its children's. */
function* selfTimes(pid, tid) {
    const own = events
        .filter((e) => e.pid === pid && e.tid === tid && e.ph === "X" && e.dur > 0)
        .sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    const stack = [];
    const childUs = new Map();

    for (const event of own) {
        while (stack.length && stack[stack.length - 1].ts + stack[stack.length - 1].dur <= event.ts) {
            const done = stack.pop();
            yield [ done, done.dur - (childUs.get(done) ?? 0) ];
        }
        const parent = stack[stack.length - 1];
        if (parent) childUs.set(parent, (childUs.get(parent) ?? 0) + event.dur);
        stack.push(event);
    }
    while (stack.length) {
        const done = stack.pop();
        yield [ done, done.dur - (childUs.get(done) ?? 0) ];
    }
}

function kindOf(name) {
    if (/compile|parseOnBackground|V8\.Parse/i.test(name)) return "compile";
    if (/GC|V8\.GC_/.test(name)) return "gc";
    if (name === "UpdateLayoutTree" || name === "RecalculateStyles") return "style";
    if (name === "ParseAuthorStyleSheet") return "css-parse";
    if (name === "Layout") return "layout";
    if (/^(Paint|PrePaint|Layerize|UpdateLayer|PaintImage|Commit|Decode)/.test(name)) return "paint";
    if (name === "ParseHTML") return "html";
    if (/FunctionCall|EvaluateScript|evaluateModule|RunMicrotasks|TimerFire|EventDispatch|FireAnimationFrame|HandlePostMessage|FireIdleCallback|v8\.run|V8\.Execute/i.test(name)) return "script";
    return "other";
}

/**
 * Maps a profile frame to the module it came from. With a maps directory, a hashed chunk such as
 * `desktop-mmUUZnv-.js` resolves through its `.map` to the original path; without one, or for a
 * frame no map covers, the chunk name stands in.
 */
function createSourceResolver(mapsDir) {
    const maps = new Map();

    const load = (chunk) => {
        if (maps.has(chunk)) return maps.get(chunk);
        const path = mapsDir ? join(mapsDir, `${chunk}.map`) : null;
        const map = path && existsSync(path) ? parseSourceMap(JSON.parse(readFileSync(path, "utf8"))) : null;
        maps.set(chunk, map);
        return map;
    };

    return (url, line, column) => {
        const chunk = url.split("/").pop().split("?")[0];
        const map = load(chunk);
        const source = map?.lookup(line, column);
        return source ? shortenSource(source) : chunk;
    };
}

/** Decodes a v3 source map's `mappings` into per-line segment lists, for a line/column lookup. */
function parseSourceMap(map) {
    const lines = [];
    let sourceIndex = 0;

    for (const lineText of map.mappings.split(";")) {
        const segments = [];
        let column = 0;
        for (const segmentText of lineText.split(",")) {
            if (!segmentText) continue;
            const fields = decodeVlq(segmentText);
            column += fields[0];
            if (fields.length > 1) {
                sourceIndex += fields[1];
                segments.push([ column, sourceIndex ]);
            }
            // Fields 2-4 (source line, source column, name) are relative too, but only the source
            // file is needed here.
        }
        lines.push(segments);
    }

    return {
        lookup(line, column) {
            const segments = lines[line];
            if (!segments?.length) return null;
            let found = null;
            for (const segment of segments) {
                if (segment[0] > column) break;
                found = segment;
            }
            return map.sources[(found ?? segments[0])[1]] ?? null;
        }
    };
}

function decodeVlq(text) {
    // Local rather than module-level: the command runs at the top of the file, before a
    // module-level `const` below it is initialized.
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const values = [];
    let value = 0;
    let shift = 0;
    for (const char of text) {
        const digit = alphabet.indexOf(char);
        value += (digit & 31) << shift;
        if (digit & 32) {
            shift += 5;
        } else {
            values.push(value & 1 ? -(value >>> 1) : value >>> 1);
            value = 0;
            shift = 0;
        }
    }
    return values;
}

/** `../../node_modules/.pnpm/jquery@4/node_modules/jquery/dist/x.js` becomes `jquery/dist/x.js`. */
function shortenSource(source) {
    const packaged = source.split("node_modules/").pop();
    return packaged === source ? source.replace(/^(\.\.\/)+/, "") : packaged;
}

function option(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

function numeric(args, fallback) {
    const value = Number(args[0]);
    return Number.isFinite(value) ? value : fallback;
}
