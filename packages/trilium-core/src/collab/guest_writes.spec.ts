import { MIME_TYPES_DICT } from "@triliumnext/commons";
import { describe, expect, it, vi } from "vitest";

import type BCollaboration from "../becca/entities/bcollaboration.js";
import type BNote from "../becca/entities/bnote.js";
import { getContext } from "../services/context.js";
import noteService from "../services/notes.js";
import options from "../services/options.js";
import guestWrites, { MAX_GUEST_CONTENT_LENGTH, MAX_GUEST_PREVIEW_LENGTH } from "./guest_writes.js";
import collabService from "./service.js";

// scrypt runs in pure JS under the standalone suite and is far slower there.
const isBrowserRuntime = typeof window !== "undefined";
if (isBrowserRuntime) {
    vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
}

let counter = 0;

const MIMES = {
    text: "text/html",
    code: "text/plain",
    mermaid: "text/mermaid",
    canvas: "application/json",
    mindMap: "application/json",
    book: ""
};

function createNote(
    parentNoteId: string, type: keyof typeof MIMES = "text", content = "<p>hello</p>"
): BNote {
    counter++;

    return getContext().init(() =>
        noteService.createNewNote({
            parentNoteId,
            title: `guest-writes-spec-${counter}`,
            content,
            type,
            mime: MIMES[type]
        })
    ).note;
}

async function openCollab(note: BNote): Promise<BCollaboration> {
    return getContext().init(() => collabService.createCollaboration(note.noteId, {
        includeSubtree: true,
        viewMode: "open",
        editMode: "open",
        createMode: "none"
    }));
}

describe("guest writes", () => {
    it("refuses notes guests cannot edit", () => {
        const note = createNote("root");
        note.type = "image";
        expect(guestWrites.isGuestEditableNote(note)).toBe(false);
        expect(() => getContext().init(() =>
            guestWrites.updateContentAsGuest(note, "<p>x</p>", null)))
            .toThrow(/only edit/);
        note.type = "text";

        getContext().init(() => note.setLabel("readOnly"));
        expect(guestWrites.isGuestEditableNote(note)).toBe(false);
        expect(() => getContext().init(() => guestWrites.updateTitleAsGuest(note, "Renamed")))
            .toThrow(/only edit/);
    });

    it("sanitizes text, keeps links, drops inline images and includes, skips saveLinks", () => {
        const note = createNote("root");
        const dirty = [
            "<p>Hello <a href=\"https://example.com\">site</a></p>",
            "<script>alert(1)</script>",
            "<p><img src=\"data:image/png;base64,AAAA\"></p>",
            "<section class=\"include-note\" data-note-id=\"abc\"></section>",
            "<p><a href=\"#root/xyz\">internal</a></p>"
        ].join("");

        const result = getContext().init(() =>
            guestWrites.updateContentAsGuest(note, dirty, note.blobId ?? null));

        expect(result.ok).toBe(true);
        const saved = String(note.getContent());
        expect(saved).toContain("<a href=\"https://example.com\">site</a>");
        expect(saved).toContain("#root/xyz");
        expect(saved).not.toContain("<script");
        expect(saved).not.toContain("data:image");
        expect(saved).not.toContain("include-note");
        // saveLinks would have turned the internal link into a relation.
        expect(note.getRelations("internalLink")).toEqual([]);
    });

    it("keeps code as sent", () => {
        const note = createNote("root", "code", "x = 1");
        const code = "<not html> & x = 2";

        getContext().init(() => guestWrites.updateContentAsGuest(note, code, null));

        expect(note.getContent()).toBe(code);
    });

    it("sets and clears the color and icon labels, refusing anything but plain values", () => {
        const note = createNote("root");

        const set = getContext().init(() =>
            guestWrites.updateAppearanceAsGuest(note, {
                color: "#ff8800", iconClass: "bx bx-star"
            }));
        expect(set).toEqual({ color: "#ff8800", iconClass: "bx bx-star" });
        expect(note.getLabelValue("color")).toBe("#ff8800");
        expect(String(note.getIcon())).toContain("bx-star");

        // A field left out stays; null clears.
        const cleared = getContext().init(() =>
            guestWrites.updateAppearanceAsGuest(note, { color: null }));
        expect(cleared).toEqual({ color: null, iconClass: "bx bx-star" });

        for (const bad of [ "red;background:url(x)", "url(evil)", "#zz", "a".repeat(30) ]) {
            expect(() => getContext().init(() =>
                guestWrites.updateAppearanceAsGuest(note, { color: bad }))).toThrow(/color/);
        }
        // Only icons of the built-in packs, so no other class reaches the page.
        const notIcons = [ "bx bx-star\" onclick", "collab-password-toggle", "bx bx-no-such-icon" ];
        for (const iconClass of notIcons) {
            expect(() => getContext().init(() =>
                guestWrites.updateAppearanceAsGuest(note, { iconClass }))).toThrow(/iconClass/);
        }
        expect(getContext().init(() =>
            guestWrites.updateAppearanceAsGuest(note, { color: "oklch(70% 0.1 200)" })).color)
            .toBe("oklch(70% 0.1 200)");
        expect(note.getLabelValue("iconClass")).toBe("bx bx-star");
    });

    it("switches a note between text and the offered languages, never into runnable code", () => {
        const note = createNote("root");

        const toCode = getContext().init(() =>
            guestWrites.changeTypeAsGuest(note, "code", "text/x-python"));
        expect(toCode).toEqual({ type: "code", mime: "text/x-python" });
        // As in the app, the content stays as it is.
        expect(note.getContent()).toBe("<p>hello</p>");

        const refused: [ string, string ][] = [
            [ "code", "application/javascript;env=frontend" ],
            [ "code", "application/javascript;env=backend" ],
            [ "code", "text/jsx" ],
            [ "code", "text/x-sqlite;schema=trilium" ],
            [ "code", "text/html" ],
            [ "code", "text/x-no-such-language" ],
            [ "text", "text/plain" ],
            [ "render", "" ]
        ];
        for (const [ type, mime ] of refused) {
            expect(() => getContext().init(() => guestWrites.changeTypeAsGuest(note, type, mime)),
                `${type} ${mime}`).toThrow(/switch/);
        }

        const toText = getContext().init(() =>
            guestWrites.changeTypeAsGuest(note, "text", "text/html"));
        expect(toText).toEqual({ type: "text", mime: "text/html" });

        const languages = guestWrites.getGuestCodeLanguages();
        const offered = languages.filter((language) => !language.runs)
            .map((language) => language.mime);
        expect(offered).toContain("text/plain");
        expect(offered).toContain("text/x-python");
        // What the app's script service and SQL console run.
        const runnable = /javascript|^text\/jsx$|^text\/x-sqlite;schema=trilium$|^text\/html$/;
        expect(offered.filter((mime) => runnable.test(mime))).toEqual([]);
        expect(languages.filter((language) => runnable.test(language.mime))
            .every((language) => language.runs)).toBe(true);
    });

    it("switches between the types guests have editors for, and into no other", () => {
        const note = createNote("root");
        const targets: [ string, string ][] = [
            [ "mermaid", "text/mermaid" ],
            [ "canvas", "application/json" ],
            [ "mindMap", "application/json" ],
            [ "book", "" ],
            [ "code", "text/x-markdown" ],
            [ "text", "text/html" ]
        ];

        // Each switch starts from the type before it, so each new type is editable too.
        for (const [ type, mime ] of targets) {
            expect(getContext().init(() => guestWrites.changeTypeAsGuest(note, type, mime)), type)
                .toEqual({ type, mime });
            expect(guestWrites.isGuestEditableNote(note), type).toBe(true);
        }

        const refused: [ string, string ][] = [
            [ "render", "" ], [ "webView", "" ], [ "relationMap", "application/json" ],
            [ "search", "" ], [ "noteMap", "" ], [ "llmChat", "application/json" ],
            [ "spreadsheet", "application/json" ], [ "image", "image/png" ],
            [ "file", "application/pdf" ], [ "launcher", "" ], [ "doc", "" ],
            [ "contentWidget", "" ], [ "mermaid", "text/plain" ], [ "canvas", "" ],
            [ "mindMap", "text/plain" ], [ "book", "text/html" ]
        ];
        for (const [ type, mime ] of refused) {
            expect(() => getContext().init(() => guestWrites.changeTypeAsGuest(note, type, mime)),
                `${type} ${mime}`).toThrow(/switch/);
        }
        expect(note.type).toBe("text");
    });

    it("keeps diagrams as sent, wants JSON for canvases and mind maps, refuses collections", () => {
        const diagram = createNote("root", "mermaid", "graph TD");
        const source = "graph TD\n  A[<b>x</b>] --> B";
        getContext().init(() => guestWrites.updateContentAsGuest(diagram, source, null));
        expect(diagram.getContent()).toBe(source);

        const canvas = createNote("root", "canvas", "");
        for (const bad of [ "not json", "[1]", "null", "\"text\"" ]) {
            expect(() => getContext().init(() =>
                guestWrites.updateContentAsGuest(canvas, bad, null)), bad).toThrow(/JSON object/);
        }
        const scene = JSON.stringify({
            type: "excalidraw", version: 2, elements: [], files: {}, appState: {}
        });
        getContext().init(() => guestWrites.updateContentAsGuest(canvas, scene, null));
        expect(canvas.getContent()).toBe(scene);

        const map = createNote("root", "mindMap", "");
        expect(() => getContext().init(() => guestWrites.updateContentAsGuest(map, "{", null)))
            .toThrow(/JSON object/);

        const collection = createNote("root", "book", "");
        expect(() => getContext().init(() =>
            guestWrites.updateContentAsGuest(collection, "<p>x</p>", null))).toThrow(/no content/);
    });

    it("takes only plain data from a mind map, and no picture the map did not hold", () => {
        const picture = {
            url: "api/attachments/abcdefabcdef/image/pic.png", width: 100, height: 50
        };
        const map = createNote("root", "mindMap", JSON.stringify({
            nodeData: { id: "root", topic: "Root", image: picture, children: [] }
        }));
        const sent = {
            nodeData: {
                id: "root",
                topic: "Root",
                image: { ...picture, width: 200 },
                children: [
                    {
                        id: "a",
                        topic: "<b>A</b>",
                        dangerouslySetInnerHTML: "<img src=x onerror=alert(1)>",
                        hyperLink: "javascript:alert(1)",
                        memo: "<p>kept</p><script>alert(1)</script>"
                            + "<section class=\"include-note\" data-note-id=\"x\"></section>",
                        image: { url: "api/images/secretNoteId/x.png", width: 10, height: 10 }
                    },
                    {
                        id: "b", topic: "B", hyperLink: "#root/abcdefabcdef", memo: "Tom & Jerry <3"
                    },
                    { id: "c", topic: "C", hyperLink: "https://example.com" }
                ]
            },
            arrows: [ { id: "x", label: "<img src=x onerror=alert(1)>a < b", from: "a", to: "b" } ],
            summaries: [ { id: "s", label: "<b>sum</b>", parent: "root", start: 0, end: 1 } ]
        };

        getContext().init(() =>
            guestWrites.updateContentAsGuest(map, JSON.stringify(sent), null));

        const saved = JSON.parse(String(map.getContent()));
        expect(saved.nodeData.image).toEqual({ ...picture, width: 200 });
        const [ a, b, c ] = saved.nodeData.children;
        // Mind Elixir writes a topic as text, so it stays as typed.
        expect(a.topic).toBe("<b>A</b>");
        expect(a).not.toHaveProperty("dangerouslySetInnerHTML");
        expect(a).not.toHaveProperty("hyperLink");
        expect(a).not.toHaveProperty("image");
        expect(a.memo).toContain("<p>kept</p>");
        expect(a.memo).not.toMatch(/script|include-note/);
        expect(b.hyperLink).toBe("#root/abcdefabcdef");
        expect(b.memo).toBe("Tom & Jerry <3");
        expect(c.hyperLink).toBe("https://example.com");
        expect(saved.arrows[0].label).toBe("a &lt; b");
        expect(saved.summaries[0].label).toBe("sum");
    });

    it("stores the preview a guest draws, sanitized, under the type's own title", () => {
        const diagram = createNote("root", "mermaid", "graph TD");
        const svg = [
            "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 10 10\">",
            "<style>.a > .b { fill: blue; }</style>",
            "<script>alert(1)</script>",
            "<foreignObject><iframe src=\"javascript:alert(2)\"></iframe>",
            "<div xmlns=\"http://www.w3.org/1999/xhtml\"><p>Label</p></div></foreignObject>",
            "<rect width=\"10\" height=\"10\" onclick=\"alert(3)\" style=\"fill: red\"/>",
            "<a href=\"jav&#x61;script:alert(4)\"><text>x</text></a>",
            "</svg>"
        ].join("");

        getContext().init(() =>
            guestWrites.updateContentAsGuest(diagram, "graph TD; A-->B", null, svg));

        const previews = () => diagram.getAttachments()
            .filter((attachment) => attachment.title === "mermaid-export.svg");
        expect(previews()).toHaveLength(1);
        expect(previews()[0]).toMatchObject({ role: "image", mime: "image/svg+xml" });
        const stored = String(previews()[0].getContent());
        expect(stored).toMatch(/^<svg/);
        expect(stored).toContain(".a > .b { fill: blue; }");
        expect(stored).toContain("<p>Label</p>");
        expect(stored).toContain("style=\"fill: red\"");
        expect(stored).not.toMatch(/<script|<iframe|onclick|javascript/i);

        // The next save replaces the preview instead of adding one.
        const next = "<svg xmlns=\"http://www.w3.org/2000/svg\"><circle r=\"1\"/></svg>";
        getContext().init(() =>
            guestWrites.updateContentAsGuest(diagram, "graph TD; A-->C", null, next));
        expect(previews()).toHaveLength(1);
        expect(String(previews()[0].getContent())).toContain("<circle");

        // A preview that is too large or not an SVG is left out, and the content still saves.
        const tooLarge = `<svg>${"a".repeat(MAX_GUEST_PREVIEW_LENGTH)}</svg>`;
        for (const bad of [ "<html><body>x</body></html>", tooLarge ]) {
            getContext().init(() =>
                guestWrites.updateContentAsGuest(diagram, "graph TD; A-->D", null, bad));
            expect(String(previews()[0].getContent())).toContain("<circle");
        }
        expect(diagram.getContent()).toBe("graph TD; A-->D");

        // A type without a preview of its own gets none.
        const text = createNote("root");
        getContext().init(() => guestWrites.updateContentAsGuest(text, "<p>x</p>", null, next));
        expect(text.getAttachments()).toEqual([]);
    });

    it("lists the languages the app lists, leaving the ones Trilium runs to the host", () => {
        const previous = options.getOption("codeNotesMimeTypes");
        const setLanguages = (value: string) =>
            getContext().init(() => options.setOption("codeNotesMimeTypes", value));
        const note = createNote("root");
        const toType = (type: string, mime: string) =>
            getContext().init(() => guestWrites.changeTypeAsGuest(note, type, mime));

        try {
            setLanguages(JSON.stringify(
                [ "text/x-python", "application/javascript;env=frontend", null ]));
            // As the app lists them: what the host enabled, and plain text, in the app's order.
            expect(guestWrites.getGuestCodeLanguages()).toEqual([
                { mime: "text/plain", title: "Plain text", runs: false },
                {
                    mime: "application/javascript;env=frontend",
                    title: "JavaScript (Trilium frontend)",
                    runs: true
                },
                { mime: "text/x-python", title: "Python", runs: false }
            ]);

            expect(toType("code", "text/x-python"))
                .toEqual({ type: "code", mime: "text/x-python" });
            // Markdown is a type of its own in the app's menu, whatever the languages.
            expect(toType("code", "text/x-markdown"))
                .toEqual({ type: "code", mime: "text/x-markdown" });
            for (const mime of [ "application/javascript;env=frontend", "text/x-rustsrc" ]) {
                expect(() => toType("code", mime), mime).toThrow(/switch/);
            }

            // Without a readable setting, the app lists its defaults.
            setLanguages("not json");
            const defaults = guestWrites.getGuestCodeLanguages();
            expect(defaults.map((language) => language.mime)).toEqual(MIME_TYPES_DICT
                .filter((language) => language.default || language.mime === "text/plain")
                .map((language) => language.mime));
            expect(defaults.filter((language) => language.runs).map((language) => language.title))
                .toEqual([
                    "HTML", "JavaScript", "JavaScript (Trilium backend)",
                    "JavaScript (Trilium frontend)", "JSX", "SQLite (Trilium)"
                ]);
        } finally {
            setLanguages(previous);
        }
    });

    it("leaves code the host's app runs or renders to the host", () => {
        const runnable = [
            "application/javascript;env=frontend", "application/javascript;env=backend",
            "text/javascript", "text/jsx", "text/x-sqlite;schema=trilium", "text/html"
        ];

        for (const mime of runnable) {
            const script = createNote("root", "code", "api.log(1)");
            script.mime = mime;
            expect(guestWrites.isGuestEditableNote(script), mime).toBe(false);
            const save = () => guestWrites.updateContentAsGuest(script, "x", script.blobId ?? null);
            expect(() => getContext().init(save), mime).toThrow();
            expect(() => getContext().init(() =>
                guestWrites.changeTypeAsGuest(script, "code", "text/plain")), mime).toThrow();
        }
    });

    it("refuses a stale save with the current content, then accepts the reconciled one", () => {
        const note = createNote("root");
        const original = note.blobId ?? "";

        const first = getContext().init(() =>
            guestWrites.updateContentAsGuest(note, "<p>first</p>", original));
        expect(first.ok).toBe(true);
        expect(first.ok && first.blobId).not.toBe(original);

        const stale = getContext().init(() =>
            guestWrites.updateContentAsGuest(note, "<p>stale</p>", original));
        expect(stale.ok).toBe(false);
        expect(stale.ok === false && stale.current)
            .toEqual({ blobId: note.blobId, content: "<p>first</p>" });
        expect(note.getContent()).toBe("<p>first</p>");

        const reconciled = getContext().init(() =>
            guestWrites.updateContentAsGuest(note, "<p>merged</p>", note.blobId ?? null));
        expect(reconciled.ok).toBe(true);
        expect(note.getContent()).toBe("<p>merged</p>");
    });

    it("caps the content size and the title", () => {
        const note = createNote("root");

        expect(() => getContext().init(() =>
            guestWrites.updateContentAsGuest(note, "a".repeat(MAX_GUEST_CONTENT_LENGTH + 1), null)))
            .toThrow(/too large/);
        expect(() => getContext().init(() => guestWrites.updateTitleAsGuest(note, "   ")))
            .toThrow(/title must be/);
    });

    it("tags the safety revision as a guest edit", () => {
        const note = createNote("root");
        const previous = options.getOption("revisionSnapshotTimeInterval");

        try {
            getContext().init(() => options.setOption("revisionSnapshotTimeInterval", "0"));
            getContext().init(() => guestWrites.updateContentAsGuest(note, "<p>changed</p>", null));
        } finally {
            getContext().init(() => options.setOption("revisionSnapshotTimeInterval", previous));
        }

        const sources = note.getRevisions().map((revision) => revision.source);
        expect(sources).toContain("collab");
    });

    it("renames a note and creates a child inside the collaboration only", async () => {
        const root = createNote("root");
        const outside = createNote("root");
        const collab = await openCollab(root);

        const renamed = getContext().init(() =>
            guestWrites.updateTitleAsGuest(root, " <b>Guest</b> title "));
        expect(renamed.title).toBe("<b>Guest</b> title");
        expect(root.title).toBe("<b>Guest</b> title");

        const child = getContext().init(() =>
            guestWrites.createChildAsGuest(collab, root, " New child "));
        expect(child.title).toBe("New child");
        expect(root.getChildNotes().map((note) => note.noteId)).toContain(child.noteId);

        // Without a title, the note is named as the app names a new one.
        const untitled = getContext().init(() => guestWrites.createChildAsGuest(collab, root));
        expect(untitled.title).toBe("New note");

        expect(() => getContext().init(() =>
            guestWrites.createChildAsGuest(collab, outside, "Nope")))
            .toThrow(/inside the collaboration/);

        collab.includeSubtree = false;
        expect(() => getContext().init(() => guestWrites.createChildAsGuest(collab, root, "Nope")))
            .toThrow(/inside the collaboration/);
    });
});
