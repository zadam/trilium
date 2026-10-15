import type { LlmMessage, LlmStreamChunk } from "@triliumnext/commons";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
    directory: "",
    connections: [] as any[],
    calls: [] as { method: string; params: any }[],
    failNew: false,
    failPrompt: false,
    authError: false,
    missingExecutable: false,
    hold: false,
    owned: false,
    protocol: 1,
    scopes: [] as any[],
    extensions: [] as any[],
    pending: new Map<string, (result: unknown) => void>()
}));
vi.mock("../../data_dir.js", () => ({
    default: {
        get TRILIUM_DATA_DIR() {
            return state.directory;
        }
    }
}));
vi.mock("./acp_client.js", async (importOriginal) => {
    const original = await importOriginal<typeof import("./acp_client.js")>();
    return {
        ...original,
        AcpClient: {
            start: vi.fn((_binary, options) => {
                let nextSession = 1;
                const client = {
                    alive: true,
                    dispose() {
                        this.alive = false;
                    },
                    notify(method: string, params: unknown) {
                        state.calls.push({ method, params });
                    },
                    async request(method: string, params: any) {
                        state.calls.push({ method, params });
                        switch (method) {
                            case "initialize":
                                if (state.missingExecutable) throw new Error("spawn gosling ENOENT");
                                return {
                                    _meta: { goslingClientToolPolicyVersion: state.protocol }
                                };
                            case "_gosling/unstable/providers/list":
                                return {
                                    entries: [
                                        {
                                            providerId: "api",
                                            providerName: "API",
                                            configured: true,
                                            stale: false,
                                            refreshing: false,
                                            executesToolsOutsideGosling: state.owned,
                                            capabilities: {
                                                contextOwnership: "gosling",
                                                nativeResume: "supported"
                                            },
                                            models: [{ id: "model", recommended: true }]
                                        },
                                        {
                                            providerId: "subscription",
                                            providerName: "Subscription",
                                            configured: true,
                                            stale: true,
                                            refreshing: false,
                                            executesToolsOutsideGosling: false,
                                            capabilities: { contextOwnership: "gosling" },
                                            models: [{ id: "model" }]
                                        }
                                    ]
                                };
                            case "_gosling/unstable/config/extensions/list":
                                return { extensions: state.extensions };
                            case "session/new":
                                if (state.failNew) throw new Error("Unavailable model");
                                return {
                                    sessionId: `session-${state.connections.length}-${nextSession++}`,
                                    _meta: {
                                        clientToolPolicy: {
                                            version: 1,
                                            providerId: params._meta.provider,
                                            modelId: params._meta.model
                                        }
                                    }
                                };
                            case "session/load":
                                return {
                                    _meta: {
                                        clientToolPolicy: {
                                            version: 1,
                                            providerId: "api",
                                            modelId: "model"
                                        }
                                    }
                                };
                            case "session/prompt":
                                options.onNotification("session/update", {
                                    sessionId: params.sessionId,
                                    update: {
                                        sessionUpdate: "agent_message_chunk",
                                        content: { type: "text", text: "synthetic answer" }
                                    }
                                });
                                if (state.authError) {
                                    throw new original.AcpError(-32000, "Authentication required: expired credential synthetic-secret");
                                }
                                if (state.failPrompt) throw new Error("Expired authentication");
                                if (state.hold)
                                    return new Promise((resolve) => {
                                        state.pending.set(params.sessionId, resolve);
                                    });
                                return { stopReason: "end_turn" };
                            default:
                                throw new Error(`Unexpected method: ${method}`);
                        }
                    }
                };
                state.connections.push({ client, options });
                return client;
            })
        }
    };
});
vi.mock("./acp_mcp_endpoint.js", () => ({
    createScopedAcpMcpEndpoint: vi.fn(async (policy) => {
        const scope = { url: "http://127.0.0.1:9876/synthetic", revoke: vi.fn(), policy };
        state.scopes.push(scope);
        return scope;
    })
}));

const { GoslingProvider } = await import("./gosling.js");
const model = JSON.stringify(["api", "model"]);
const config = { providerId: "gateway", chatNoteId: "chat-a", model };
const first: LlmMessage[] = [{ role: "user", content: "Synthetic prompt" }];
const followup: LlmMessage[] = [
    ...first,
    { role: "assistant", content: "synthetic answer" },
    { role: "user", content: "Follow up" }
];
async function collect(stream: AsyncIterable<LlmStreamChunk>) {
    const chunks: LlmStreamChunk[] = [];
    for await (const chunk of stream) chunks.push(chunk);
    return chunks;
}

describe("Gosling gateway session contract", () => {
    let provider: InstanceType<typeof GoslingProvider>;
    beforeEach(() => {
        state.directory = fs.mkdtempSync(path.join(os.tmpdir(), "trilium-gosling-spec-"));
        Object.assign(state, {
            connections: [],
            calls: [],
            scopes: [],
            extensions: [],
            failNew: false,
            failPrompt: false,
            authError: false,
            missingExecutable: false,
            hold: false,
            owned: false,
            protocol: 1,
            pending: new Map()
        });
        provider = new GoslingProvider();
    });
    afterEach(() => {
        provider.dispose();
        fs.rmSync(state.directory, { recursive: true, force: true });
    });

    it("pins exact selection, streams in order, reuses one process and keeps chats independent", async () => {
        const chunks = await collect(provider.chatChunks(first, config));
        expect(chunks.map((chunk) => chunk.type)).toEqual([
            "status",
            "session_info",
            "text",
            "done"
        ]);
        await collect(provider.chatChunks(followup, config));
        await collect(provider.chatChunks(first, { ...config, chatNoteId: "chat-b" }));
        expect(state.connections).toHaveLength(1);
        const sessions = state.calls.filter((call) => call.method === "session/new");
        expect(sessions).toHaveLength(2);
        expect(sessions[0].params._meta).toEqual({
            provider: "api",
            model: "model",
            enabledExtensions: [],
            clientToolPolicy: { version: 1 }
        });
        expect(state.calls.some((call) => /config\/save|set-provider/.test(call.method))).toBe(
            false
        );
        const prompts = state.calls.filter((call) => call.method === "session/prompt");
        expect(prompts[0].params.sessionId).toBe(prompts[1].params.sessionId);
        expect(prompts[2].params.sessionId).not.toBe(prompts[0].params.sessionId);
    });
    it("preserves the original session when a selected subscription transition fails", async () => {
        await collect(provider.chatChunks(first, config));
        state.failNew = true;
        await expect(
            collect(
                provider.chatChunks(followup, {
                    ...config,
                    model: JSON.stringify(["subscription", "model"]),
                    goslingHandoff: true
                })
            )
        ).rejects.toThrow();
        state.failNew = false;
        await collect(provider.chatChunks(followup, config));
        const prompts = state.calls.filter((call) => call.method === "session/prompt");
        expect(prompts).toHaveLength(2);
        expect(prompts[0].params.sessionId).toBe(prompts[1].params.sessionId);
    });
    it("preserves the usable session if persisting a new handoff fails", async () => {
        await collect(provider.chatChunks(first, config));
        vi.spyOn(fs, "writeFileSync").mockImplementationOnce(() => { throw new Error("ENOSPC"); });
        await expect(collect(provider.chatChunks(followup, { ...config, model: JSON.stringify(["subscription", "model"]), goslingHandoff: true }))).rejects.toThrow(/previous session is preserved/);
        await collect(provider.chatChunks(followup, config));
        const prompts = state.calls.filter(call => call.method === "session/prompt");
        expect(prompts).toHaveLength(2);
        expect(prompts[0].params.sessionId).toBe(prompts[1].params.sessionId);
        vi.restoreAllMocks();
    });

    it("requires an explicit handoff for provider changes and interrupted histories", async () => {
        await collect(provider.chatChunks(first, config));
        await expect(
            collect(
                provider.chatChunks(followup, {
                    ...config,
                    model: JSON.stringify(["subscription", "model"])
                })
            )
        ).rejects.toThrow(/explicit handoff/);
        state.failPrompt = true;
        await expect(collect(provider.chatChunks(followup, config))).rejects.toThrow(
            /authentication/
        );
        state.failPrompt = false;
        await expect(collect(provider.chatChunks(followup, config))).rejects.toThrow(
            /explicit handoff/
        );
    });
    it("resumes saved mappings after a restart without replaying or duplicating the first prompt", async () => {
        await collect(provider.chatChunks(first, config));
        provider.dispose();
        provider = new GoslingProvider();
        await collect(provider.chatChunks(followup, config));
        expect(state.calls.filter((call) => call.method === "session/new")).toHaveLength(1);
        expect(state.calls.filter((call) => call.method === "session/load")).toHaveLength(1);
        expect(state.calls.filter((call) => call.method === "session/prompt")).toHaveLength(2);
        expect(
            fs.statSync(path.join(state.directory, "gosling-local", "sessions.json")).mode & 0o777
        ).toBe(0o600);
    });
    it("cancels only the addressed chat, revokes note capabilities, and never reports done", async () => {
        state.hold = true;
        const stream = provider.chatChunks(first, { ...config, enableNoteTools: true });
        const chunks: LlmStreamChunk[] = [];
        const running = (async () => {
            for await (const chunk of stream) chunks.push(chunk);
        })();
        await vi.waitFor(() =>
            expect(state.calls.some((call) => call.method === "session/prompt")).toBe(true)
        );
        provider.revoke("chat-a");
        await expect(running).rejects.toThrow(/interrupted/);
        expect(chunks.some((chunk) => chunk.type === "done")).toBe(false);
        expect(state.scopes[0].revoke).toHaveBeenCalled();
        expect(state.scopes[0].policy("get_note", { mutates: false })).toBe(false);
        expect(state.calls.filter((call) => call.method === "session/cancel")).toHaveLength(1);
        state.hold = false;
        await collect(provider.chatChunks(first, { ...config, chatNoteId: "chat-b" }));
        expect(state.connections).toHaveLength(1);
    });
    it("keeps concurrent streams and cancellation isolated on the shared connection", async () => {
        state.hold = true;
        const a = collect(provider.chatChunks(first, config)).catch((error) => error as Error);
        const b = collect(provider.chatChunks(first, { ...config, chatNoteId: "chat-b" }));
        await vi.waitFor(() => expect(state.pending.size).toBe(2));
        await expect(
            collect(provider.chatChunks(first, { ...config, providerId: "another-gateway-config" }))
        ).rejects.toThrow(/already has an active turn/);
        const prompts = state.calls.filter((call) => call.method === "session/prompt");
        const sessionB = prompts[1].params.sessionId;
        state.connections[0].options.onNotification("session/update", {
            sessionId: sessionB,
            update: {
                sessionUpdate: "agent_message_chunk",
                content: { type: "text", text: " only-b" }
            }
        });
        provider.revoke("chat-a");
        expect(await a).toBeInstanceOf(Error);
        state.pending.get(sessionB)?.({ stopReason: "end_turn" });
        const chunks = await b;
        expect(
            chunks
                .filter((chunk) => chunk.type === "text")
                .map((chunk) => chunk.content)
                .join("")
        ).toBe("synthetic answer only-b");
        expect(chunks.at(-1)?.type).toBe("done");
        expect(
            state.calls.filter((call) => call.method === "session/cancel")[0].params.sessionId
        ).toBe(prompts[0].params.sessionId);
    });

    it("forwards only explicitly selected MCP extensions and never persists their credentials", async () => {
        const selected = {
            type: "mcp",
            server: {
                type: "http",
                name: "math_mcp",
                url: "http://127.0.0.1:9999/mcp",
                headers: [{ name: "Authorization", value: "synthetic-mcp-token" }]
            },
            available_tools: ["evaluate"]
        };
        state.extensions = [
            { enabled: true, configKey: "math_mcp", extension: selected },
            {
                enabled: true,
                configKey: "cephalopod-ai",
                extension: { type: "mcp", server: { name: "cephalopod-ai" } }
            },
            {
                enabled: true,
                configKey: "trilium",
                extension: { type: "mcp", server: { name: "trilium" } }
            }
        ];
        await collect(provider.chatChunks(first, { ...config, goslingExtensions: ["math_mcp"] }));
        const created = state.calls.find((call) => call.method === "session/new");
        expect(created?.params._meta.enabledExtensions).toEqual([selected]);
        const mapping = fs.readFileSync(
            path.join(state.directory, "gosling-local", "sessions.json"),
            "utf8"
        );
        expect(mapping).not.toContain("synthetic-mcp-token");
        expect(state.calls.some((call) => call.method.includes("providers/secrets"))).toBe(false);
    });

    it("requires inventory review before a cached local endpoint can become external or unknown", async () => {
        await expect(
            collect(
                provider.chatChunks(first, { ...config, goslingExpectedEndpointLocation: "local" })
            )
        ).rejects.toThrow(/endpoint locality changed/);
        expect(state.calls.some((call) => call.method === "session/prompt")).toBe(false);
    });

    it("rejects unavailable models without selecting any substitute", async () => {
        await expect(
            collect(
                provider.chatChunks(first, {
                    ...config,
                    model: JSON.stringify(["api", "missing-model"])
                })
            )
        ).rejects.toThrow(/unavailable/);
        expect(
            state.calls.some(
                (call) => call.method === "session/new" || call.method === "session/prompt"
            )
        ).toBe(false);
    });

    it("blocks provider-owned tool execution and older binaries before any inference", async () => {
        state.owned = true;
        await expect(collect(provider.chatChunks(first, config))).rejects.toThrow(
            /outside Gosling/
        );
        expect(state.calls.some((call) => call.method === "session/prompt")).toBe(false);
        provider.dispose();
        state.protocol = 0;
        await expect(provider.listModels()).rejects.toThrow(/bounded client tool policy/);
    });
    it("reports subscription authentication without exposing runtime details or using an API route", async () => {
        state.authError = true;
        await expect(collect(provider.chatChunks(first, {
            ...config, model: JSON.stringify(["subscription", "model"])
        }))).rejects.toThrow(/Gosling authentication required.*gosling configure/);
        const inventory = await provider.inventory();
        expect(inventory.providers.find(entry => entry.id === "subscription")).toMatchObject({
            authenticationRequired: true, authenticationExpired: true
        });
        expect(inventory.providers.find(entry => entry.id === "api")?.authenticationRequired).toBe(false);
        expect(state.calls.filter(call => call.method === "session/new").map(call => call.params._meta.provider)).toEqual(["subscription"]);
        expect(JSON.stringify(inventory)).not.toContain("synthetic-secret");
    });
    it("explains a missing executable before creating a session or sending a prompt", async () => {
        state.missingExecutable = true;
        await expect(provider.listModels()).rejects.toThrow(/executable not found.*TRILIUM_GOSLING_BINARY/);
        expect(state.calls.some(call => call.method === "session/new" || call.method === "session/prompt")).toBe(false);
    });
    it("does not expose writes until independently authorized", async () => {
        await collect(provider.chatChunks(first, { ...config, enableNoteTools: true }));
        expect(state.scopes[0].policy("set_note_content", { mutates: true })).toBe(false);
        // A completed scope is also revoked; the endpoint enforces that removal independently.
        expect(state.scopes[0].revoke).toHaveBeenCalled();
        const created = state.calls.find((call) => call.method === "session/new");
        expect(created?.params.mcpServers[0].url).toMatch(/^http:\/\/127\.0\.0\.1:/);
    });
});
