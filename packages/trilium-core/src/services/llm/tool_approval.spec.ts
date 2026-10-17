import type { LlmStreamChunk } from "@triliumnext/commons";
import { type LanguageModel, simulateReadableStream, tool, type ToolSet } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { BaseProvider } from "./providers/base_provider.js";
import { streamToChunks } from "./stream.js";
import { TOOL_CALL_DECLINED_REASON, ToolApprovals } from "./tool_approval.js";

const USAGE = {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 }
};

/** A model that calls `create_note` once, then answers with text. */
function modelCallingTool() {
    return new MockLanguageModelV4({
        doStream: [
            {
                stream: simulateReadableStream({
                    chunks: [
                        { type: "tool-call", toolCallId: "c1", toolName: "create_note", input: JSON.stringify({ title: "New" }) },
                        { type: "finish", usage: USAGE, finishReason: { unified: "tool-calls", raw: undefined } }
                    ]
                })
            },
            {
                stream: simulateReadableStream({
                    chunks: [
                        { type: "text-start", id: "t1" },
                        { type: "text-delta", id: "t1", delta: "Done." },
                        { type: "text-end", id: "t1" },
                        { type: "finish", usage: USAGE, finishReason: { unified: "stop", raw: undefined } }
                    ]
                })
            }
        ]
    });
}

class ScriptedProvider extends BaseProvider {
    name = "scripted";
    protected defaultModel = "mock";
    protected titleModel = "mock";
    readonly execute = vi.fn((_input: unknown) => ({ noteId: "n1" }));

    constructor(private readonly model: MockLanguageModelV4) {
        super("key");
    }

    protected createModel(): LanguageModel {
        return this.model;
    }

    protected override buildTools(): ToolSet {
        return {
            create_note: tool({
                description: "Create a note",
                inputSchema: z.object({ title: z.string() }),
                execute: this.execute
            })
        };
    }
}

/**
 * Run a turn through the AI SDK, answering each approval request with `approve` as soon as it
 * is made, as the user would from the chat.
 */
async function runTurn(approve: boolean) {
    const model = modelCallingTool();
    const provider = new ScriptedProvider(model);
    const toolApprovals = new ToolApprovals();
    const requests: unknown[] = [];
    toolApprovals.onRequest = (request) => {
        requests.push(request);
        queueMicrotask(() => toolApprovals.answer(request.toolCallId, approve));
    };

    const chunks: LlmStreamChunk[] = [];
    for await (const chunk of streamToChunks(provider.chat([ { role: "user", content: "make a note" } ], { toolApprovals }))) {
        chunks.push(chunk);
    }
    return { chunks, requests, execute: provider.execute, model };
}

describe("tool approval through the AI SDK", () => {
    it("runs an approved call and carries on with the turn", async () => {
        const { chunks, requests, execute, model } = await runTurn(true);

        expect(requests).toEqual([ { toolCallId: "c1", toolName: "create_note", toolInput: { title: "New" } } ]);
        expect(execute).toHaveBeenCalledOnce();
        expect(chunks).toContainEqual(expect.objectContaining({ type: "tool_result", toolCallId: "c1", isError: false }));
        expect(chunks).toContainEqual({ type: "text", content: "Done." });
        expect(model.doStreamCalls).toHaveLength(2);
    });

    it("never runs a declined call, and tells the model why before it carries on", async () => {
        const { chunks, execute, model } = await runTurn(false);

        expect(execute).not.toHaveBeenCalled();
        expect(chunks).toContainEqual({
            type: "tool_result",
            toolCallId: "c1",
            toolName: "create_note",
            result: JSON.stringify({ error: TOOL_CALL_DECLINED_REASON }),
            isError: true
        });
        expect(chunks).toContainEqual({ type: "text", content: "Done." });

        const toolMessage = model.doStreamCalls[1]?.prompt.find((message) => message.role === "tool");
        expect(JSON.stringify(toolMessage)).toContain(TOOL_CALL_DECLINED_REASON);
    });
});

describe("ToolApprovals", () => {
    it("declines what waits when the turn is stopped or closed, and every call once stopped", async () => {
        const controller = new AbortController();
        const approvals = new ToolApprovals(controller.signal);
        const stopped = approvals.request({ toolCallId: "c1", toolName: "t", toolInput: {} });
        controller.abort();
        await expect(stopped).resolves.toBe(false);
        await expect(approvals.request({ toolCallId: "c2", toolName: "t", toolInput: {} })).resolves.toBe(false);

        const open = new ToolApprovals();
        const closed = open.request({ toolCallId: "c3", toolName: "t", toolInput: {} });
        open.declineAll();
        await expect(closed).resolves.toBe(false);
        expect(open.answer("c3", true)).toBe(false);
    });
});
