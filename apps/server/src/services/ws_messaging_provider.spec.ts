import type { WebSocketMessage } from "@triliumnext/commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OPEN = 1;
const CLOSED = 3;

type Handler = (...args: any[]) => void;

const {
    state, getLogMock, configMock, randomStringMock, admitGuestSocketMock, WebSocketServerMock
} = vi.hoisted(() => {
    const state: { instances: any[] } = { instances: [] };

    class WebSocketServerMock {
        options: any;
        clients = new Set<any>();
        handlers: Record<string, (...a: any[]) => void> = {};
        closed = false;

        constructor(options: any) {
            this.options = options;
            state.instances.push(this);
        }
        on(event: string, cb: (...a: any[]) => void) {
            this.handlers[event] = cb;
            return this;
        }
        emit(event: string, ...args: any[]) {
            return this.handlers[event]?.(...args);
        }
        close() {
            this.closed = true;
        }
    }

    return {
        state,
        WebSocketServerMock,
        getLogMock: { error: vi.fn(), info: vi.fn() },
        configMock: { General: { noAuthentication: false } as { noAuthentication: boolean } | undefined },
        randomStringMock: vi.fn(() => "client-id"),
        admitGuestSocketMock: vi.fn((): unknown => false)
    };
});

vi.mock("ws", () => ({
    WebSocketServer: WebSocketServerMock,
    WebSocket: { OPEN: 1 } // keep in sync with the module-level OPEN constant
}));
vi.mock("./config.js", () => ({ default: configMock }));
vi.mock("../collab/guest_socket.js", () => ({
    admitGuestSocket: admitGuestSocketMock, COLLAB_FULL_CLOSE_CODE: 4503,
    COLLAB_REMOVED_CLOSE_CODE: 4401
}));
vi.mock("./utils.js", () => ({ randomString: randomStringMock }));
vi.mock("@triliumnext/core", async () => {
    // use the real shouldLogMessage so the suppression tests cover the actual filter
    const { shouldLogMessage } = await vi.importActual<typeof import("@triliumnext/core/src/services/messaging/index.js")>(
        "@triliumnext/core/src/services/messaging/index.js"
    );
    return { getLog: () => getLogMock, shouldLogMessage };
});

import WebSocketMessagingProvider, { isHttpAttachableMessagingProvider } from "./ws_messaging_provider.js";

const MESSAGE = { type: "reload-frontend", reason: "x" } as WebSocketMessage;

function makeSocket(readyState = OPEN) {
    const handlers: Record<string, Handler> = {};
    return {
        readyState,
        sent: [] as string[],
        handlers,
        on(event: string, cb: Handler) {
            handlers[event] = cb;
            return this;
        },
        send(data: string) {
            this.sent.push(data);
        },
        emit(event: string, ...args: any[]) {
            return handlers[event]?.(...args);
        }
    };
}

describe("WebSocketMessagingProvider", () => {
    let provider: WebSocketMessagingProvider;

    beforeEach(() => {
        provider = new WebSocketMessagingProvider();
        state.instances = [];
        getLogMock.error.mockClear();
        getLogMock.info.mockClear();
        configMock.General = { noAuthentication: false };
        randomStringMock.mockReturnValue("client-id");
        admitGuestSocketMock.mockReset();
        admitGuestSocketMock.mockReturnValue(false);
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("is recognised as HTTP-attachable (the capability www.ts gates the WS server on)", () => {
        expect(isHttpAttachableMessagingProvider(provider)).toBe(true);
        // A plain IPC-style provider without attachToHttpServer must not qualify.
        expect(isHttpAttachableMessagingProvider({
            sendMessageToAllClients() {},
            sendMessageToClient: () => false,
            setClientMessageHandler() {}
        })).toBe(false);
    });

    function init() {
        const httpServer = {} as any;
        const sessionParser = vi.fn((_req: any, _params: any, cb: () => void) => cb());
        provider.attachToHttpServer(httpServer, sessionParser as any);
        return { server: state.instances[0], sessionParser };
    }

    describe("init / verifyClient", () => {
        it("allows a logged-in session", () => {
            const { server } = init();
            const done = vi.fn();
            server.options.verifyClient({ req: { session: { loggedIn: true } } }, done);
            expect(done).toHaveBeenCalledWith(true);
            expect(getLogMock.error).not.toHaveBeenCalled();
        });

        it("allows when authentication is disabled", () => {
            configMock.General = { noAuthentication: true };
            const { server } = init();
            const done = vi.fn();
            server.options.verifyClient({ req: { session: { loggedIn: false } } }, done);
            expect(done).toHaveBeenCalledWith(true);
        });

        it("rejects and logs when not logged in and auth is required", () => {
            const { server } = init();
            const done = vi.fn();
            server.options.verifyClient({ req: { session: { loggedIn: false } } }, done);
            expect(done).toHaveBeenCalledWith(false);
            expect(getLogMock.error).toHaveBeenCalled();
        });

        it("rejects when the config has no General section", () => {
            configMock.General = undefined;
            const { server } = init();
            const done = vi.fn();
            server.options.verifyClient({ req: { session: { loggedIn: false } } }, done);
            // `config.General && config.General.noAuthentication` short-circuits to a
            // falsy value, so the connection is not allowed.
            expect(done.mock.calls[0][0]).toBeFalsy();
        });
    });

    describe("guest sockets of collaborations", () => {
        it("admits one through the collaboration check, apart from host broadcasts", () => {
            const connection = {
                collabId: "abc", guestId: "g1", unlocked: [], name: null, color: null,
                viewingNoteId: null,
                editingNoteId: null, isHost: false
            };
            admitGuestSocketMock.mockReturnValueOnce(connection);
            const { server } = init();
            const changed = vi.fn();
            provider.onCollabClientsChanged(changed);

            const done = vi.fn();
            const req: any = { url: "/?collab=abc", session: {} };
            server.options.verifyClient({ req }, done);
            expect(admitGuestSocketMock).toHaveBeenCalledWith("/?collab=abc", {});
            expect(done).toHaveBeenCalledWith(true);

            const guest = Object.assign(makeSocket(), { close: vi.fn() });
            server.emit("connection", guest, req);
            server.clients.add(guest);
            const host = makeSocket();
            server.clients.add(host);

            expect(changed).toHaveBeenCalledWith("abc");
            expect(provider.hasCollabClients()).toBe(true);
            expect(provider.getCollabClients("abc")).toEqual([ {
                guestId: "g1", unlocked: [], name: null, color: null, viewingNoteId: null,
                editingNoteId: null,
                isHost: false
            } ]);
            expect(provider.getClientCollab("client-id")).toEqual(connection);

            provider.sendMessageToAllClients({ type: "reload-frontend", reason: "x" });
            expect(host.sent).toHaveLength(1);
            expect(guest.sent).toHaveLength(0);

            provider.sendMessageToCollabClients("abc", {
                type: "collab-presence", collabId: "abc", guests: 1, people: []
            });
            expect(guest.sent).toHaveLength(1);
            expect(host.sent).toHaveLength(1);

            provider.setCollabEditing("client-id", "n1");
            expect(provider.getCollabClients("abc")[0].editingNoteId).toBe("n1");

            provider.closeCollabClients("abc");
            expect(guest.close).toHaveBeenCalledWith(1000, "collaboration ended");

            guest.emit("close");
            expect(changed).toHaveBeenCalledTimes(2);
            expect(provider.hasCollabClients()).toBe(false);
            expect(provider.getClientCollab("client-id")).toBeNull();
        });

        it("narrows a message to the pages on a note, renames a guest and drops a removed one",
            async () => {
                const { server } = init();
                const changed = vi.fn();
                const handler = vi.fn();
                provider.onCollabClientsChanged(changed);
                provider.setClientMessageHandler(handler);
                const connect = (clientId: string, guestId: string) => {
                    randomStringMock.mockReturnValueOnce(clientId);
                    admitGuestSocketMock.mockReturnValueOnce({
                        collabId: "abc", guestId, unlocked: [], name: null, color: null,
                        viewingNoteId: null,
                        editingNoteId: null, isHost: false
                    });
                    const req: any = { url: "/?collab=abc", session: {} };
                    server.options.verifyClient({ req }, vi.fn());
                    const socket = Object.assign(makeSocket(), {
                        close: vi.fn(() => {
                            socket.readyState = CLOSED;
                        })
                    });
                    server.emit("connection", socket, req);
                    server.clients.add(socket);
                    return socket;
                };
                const sender = connect("c1", "g1");
                const elsewhere = connect("c2", "g1");
                const editor = connect("c3", "g2");
                provider.setCollabViewing("c1", "n1");
                provider.setCollabViewing("c2", "n2");
                provider.setCollabEditing("c3", "n1");

                provider.sendMessageToCollabClients("abc", MESSAGE,
                    { noteId: "n1", exceptClientId: "c1" });
                expect([ sender.sent, elsewhere.sent, editor.sent ].map((sent) => sent.length))
                    .toEqual([ 0, 0, 1 ]);

                provider.setCollabGuestName("abc", "g1", "Grace");
                expect(provider.getCollabClients("abc").map((client) => client.name))
                    .toEqual([ "Grace", "Grace", null ]);
                provider.setCollabGuestColor("abc", "g1", "#d22a1e");
                expect(provider.getCollabClients("abc").map((client) => client.color))
                    .toEqual([ "#d22a1e", "#d22a1e", null ]);

                // A removed guest leaves the list at once, and the presence that follows
                // reaches only the others.
                changed.mockClear();
                changed.mockImplementation(() =>
                    provider.sendMessageToCollabClients("abc", MESSAGE));
                provider.closeCollabGuest("abc", "g1");
                expect([ sender.sent, elsewhere.sent, editor.sent ].map((sent) => sent.length))
                    .toEqual([ 0, 0, 3 ]);
                expect(sender.close).toHaveBeenCalledWith(4401, "removed");
                expect(elsewhere.close).toHaveBeenCalledWith(4401, "removed");
                expect(editor.close).not.toHaveBeenCalled();
                expect(provider.getCollabClients("abc").map((client) => client.guestId))
                    .toEqual([ "g2" ]);
                expect(changed).toHaveBeenCalledWith("abc");

                // What its socket still sends speaks for nobody, the host least of all.
                await Promise.resolve(sender.emit("message", JSON.stringify({ type: "ping" })));
                expect(handler).not.toHaveBeenCalled();
                await Promise.resolve(editor.emit("message", JSON.stringify({ type: "ping" })));
                expect(handler).toHaveBeenCalledWith("c3", { type: "ping" });
            });

        it("closes a socket the collaboration has no seat for, with the close code", () => {
            admitGuestSocketMock.mockReturnValueOnce({ refused: "full", collabId: "abc" });
            const { server } = init();
            const changed = vi.fn();
            provider.onCollabClientsChanged(changed);

            const done = vi.fn();
            const req: any = { url: "/?collab=abc", session: {} };
            server.options.verifyClient({ req }, done);
            expect(done).toHaveBeenCalledWith(true);

            const guest = Object.assign(makeSocket(), { close: vi.fn() });
            server.emit("connection", guest, req);

            expect(guest.close).toHaveBeenCalledWith(4503, "collaboration full");
            expect(changed).not.toHaveBeenCalled();
            expect(provider.hasCollabClients()).toBe(false);
            expect(provider.getClientCount()).toBe(0);
        });

        it("refuses one the collaboration check rejects", () => {
            admitGuestSocketMock.mockReturnValueOnce(null);
            const { server } = init();
            const done = vi.fn();
            server.options.verifyClient({ req: { url: "/?collab=nope", session: {} } }, done);
            expect(done).toHaveBeenCalledWith(false);
            expect(getLogMock.error).toHaveBeenCalled();
        });
    });

    describe("connection lifecycle", () => {
        it("tracks a connected client, dispatches messages, and untracks on close", async () => {
            const { server } = init();
            const handler = vi.fn();
            provider.setClientMessageHandler(handler);

            const ws = makeSocket();
            server.emit("connection", ws, {});
            expect(provider.getClientCount()).toBe(0); // server.clients still empty (we manage map)
            expect(provider.sendMessageToClient("client-id", { type: "ping" } as any)).toBe(true);

            await Promise.resolve(ws.emit("message", JSON.stringify({ type: "hello" })));
            expect(handler).toHaveBeenCalledWith("client-id", { type: "hello" });

            ws.emit("close");
            expect(provider.sendMessageToClient("client-id", { type: "ping" } as any)).toBe(false);
        });

        it("ignores incoming messages when no handler is registered", async () => {
            const { server } = init();
            const ws = makeSocket();
            server.emit("connection", ws, {});
            // With no handler registered the message listener parses the payload
            // and returns (undefined) without dispatching — emitting must not throw.
            expect(ws.emit("message", JSON.stringify({ type: "x" }))).toBeUndefined();
            await Promise.resolve(); // let the fire-and-forget async body settle
        });

        it("logs server errors via the error handler", () => {
            const { server } = init();
            expect(() => server.emit("error", new Error("ws boom"))).not.toThrow();
        });

        it("handles a per-connection error without throwing and untracks the client", () => {
            // A protocol error on a single socket (e.g. WS_ERR_INVALID_CLOSE_CODE) must not
            // bubble up as an uncaught exception that crashes the process. See issue #9598.
            const { server } = init();
            const ws = makeSocket();
            server.emit("connection", ws, {});
            expect(provider.sendMessageToClient("client-id", { type: "ping" } as any)).toBe(true);

            expect(() => ws.emit("error", new Error("WS_ERR_INVALID_CLOSE_CODE"))).not.toThrow();
            expect(provider.sendMessageToClient("client-id", { type: "ping" } as any)).toBe(false);
        });
    });

    describe("sendMessageToAllClients", () => {
        it("sends to OPEN clients and logs non-suppressed message types", () => {
            const { server } = init();
            const open = makeSocket(OPEN);
            const closed = makeSocket(CLOSED);
            server.clients.add(open);
            server.clients.add(closed);

            provider.sendMessageToAllClients({ type: "sync-finished" } as WebSocketMessage);
            expect(open.sent).toHaveLength(1);
            expect(closed.sent).toHaveLength(0);
            expect(getLogMock.info).toHaveBeenCalled();
        });

        it("does not log for suppressed message types", () => {
            const { server } = init();
            const open = makeSocket(OPEN);
            server.clients.add(open);

            provider.sendMessageToAllClients({ type: "frontend-update" } as WebSocketMessage);
            provider.sendMessageToAllClients({ type: "sync-failed" } as WebSocketMessage);
            provider.sendMessageToAllClients({ type: "api-log-messages" } as WebSocketMessage);

            expect(getLogMock.info).not.toHaveBeenCalled();
            // suppressing the log must not suppress delivery
            expect(open.sent).toHaveLength(3);
        });

        it("is a no-op when the server is not initialized", () => {
            expect(() =>
                provider.sendMessageToAllClients({ type: "frontend-update" } as WebSocketMessage)
            ).not.toThrow();
            expect(getLogMock.info).not.toHaveBeenCalled();
        });
    });

    describe("sendMessageToClient", () => {
        it("returns false for an unknown client", () => {
            init();
            expect(provider.sendMessageToClient("missing", { type: "ping" } as any)).toBe(false);
        });

        it("returns false for a client that is not OPEN", () => {
            const { server } = init();
            const ws = makeSocket(CLOSED);
            server.emit("connection", ws, {});
            expect(provider.sendMessageToClient("client-id", { type: "ping" } as any)).toBe(false);
        });

        it("sends and returns true for an OPEN client", () => {
            const { server } = init();
            const ws = makeSocket(OPEN);
            server.emit("connection", ws, {});
            expect(provider.sendMessageToClient("client-id", { type: "ping" } as any)).toBe(true);
            expect(ws.sent).toHaveLength(1);
        });
    });

    describe("getClientCount", () => {
        it("returns the server's client set size", () => {
            const { server } = init();
            server.clients.add(makeSocket());
            server.clients.add(makeSocket());
            expect(provider.getClientCount()).toBe(2);
        });

        it("returns 0 when the server is not initialized", () => {
            expect(provider.getClientCount()).toBe(0);
        });
    });

    describe("dispose", () => {
        it("closes the server and clears the client map", () => {
            const { server } = init();
            const ws = makeSocket(OPEN);
            server.emit("connection", ws, {});

            provider.dispose();
            expect(server.closed).toBe(true);
            // After dispose, server is still referenced but map is cleared.
            expect(provider.sendMessageToClient("client-id", { type: "ping" } as any)).toBe(false);
        });

        it("is safe to call before init", () => {
            expect(() => provider.dispose()).not.toThrow();
        });
    });
});
