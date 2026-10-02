import type { WebSocketMessage } from "@triliumnext/commons";
import {
    type ClientMessageHandler, type CollabClientFilter, type CollabClientInfo,
    type CollabConnection, getLog, type MessagingProvider, shouldLogMessage
} from "@triliumnext/core";
import type { IncomingMessage, Server as HttpServer } from "http";
import type express from "express";
import { WebSocket, WebSocketServer } from "ws";

import {
    admitGuestSocket, COLLAB_FULL_CLOSE_CODE, COLLAB_REMOVED_CLOSE_CODE, type GuestSocketAdmission
} from "../collab/guest_socket.js";
import config from "./config.js";
import { randomString } from "./utils.js";

type SessionParser = (req: IncomingMessage, params: {}, cb: () => void) => void;

/**
 * A messaging provider that serves clients over the TCP HTTP listener and so
 * needs the `http.Server` (and session parser for auth) handed to it once www.ts
 * has built them. www.ts detects this capability via the type guard below rather
 * than a concrete `instanceof`, so a desktop composite that wraps a WS provider
 * qualifies too.
 */
export interface HttpAttachableMessagingProvider extends MessagingProvider {
    attachToHttpServer(httpServer: HttpServer, sessionParser: express.RequestHandler): void;
}

export function isHttpAttachableMessagingProvider(provider: MessagingProvider): provider is HttpAttachableMessagingProvider {
    return typeof (provider as Partial<HttpAttachableMessagingProvider>).attachToHttpServer === "function";
}

/**
 * WebSocket-based implementation of MessagingProvider.
 *
 * Handles the raw WebSocket transport: server setup, connection management,
 * message serialization, and client tracking.
 *
 * Used directly by the server build, and by the Electron desktop build only when
 * the user has opted into LAN/network access — there it's wrapped in a composite
 * alongside the IPC provider so browser clients get live updates while the trusted
 * renderer keeps talking over IPC. Without that opt-in the desktop binds no WS
 * endpoint. See `apps/desktop/src/composite_messaging_provider.ts`.
 */
export default class WebSocketMessagingProvider implements HttpAttachableMessagingProvider {
    private webSocketServer!: WebSocketServer;
    private clientMap = new Map<string, WebSocket>();
    /** Guest sockets of collaborations by client id; none of them gets a host broadcast. */
    private collabConnections = new Map<string, CollabConnection>();
    private clientMessageHandler?: ClientMessageHandler;
    private collabClientsChanged?: (collabId: string) => void;

    attachToHttpServer(httpServer: HttpServer, sessionParser: express.RequestHandler) {
        this.webSocketServer = new WebSocketServer({
            verifyClient: (info, done) => {
                sessionParser(info.req as express.Request, {} as express.Response, () => {
                    const session = (info.req as any).session;
                    const guest = admitGuestSocket(info.req.url, session);

                    // `?collab=<id>` asks for a collaboration's guest socket.
                    if (guest !== false) {
                        if (!guest) {
                            getLog().error(
                                "WebSocket connection refused: no access to the collaboration.");
                        }

                        (info.req as any).collabConnection = guest;
                        done(!!guest);
                        return;
                    }

                    const allowed = session.loggedIn
                        || (config.General && config.General.noAuthentication);

                    if (!allowed) {
                        getLog().error("WebSocket connection not allowed: session is not logged in.");
                    }

                    done(allowed);
                });
            },
            server: httpServer
        });

        this.webSocketServer.on("connection", (ws, req) => {
            const id = randomString(10);
            (ws as any).id = id;
            this.clientMap.set(id, ws);

            const admission = (req as any)?.collabConnection as
                GuestSocketAdmission | null | undefined;

            if (admission && "refused" in admission) {
                // Accepted and closed at once: a refused upgrade reaches the page as a bare
                // network failure, a close code tells it why.
                ws.close(COLLAB_FULL_CLOSE_CODE, "collaboration full");
                this.clientMap.delete(id);
                return;
            }

            const collab = admission ?? null;

            if (collab) {
                (ws as any).collab = collab;
                this.collabConnections.set(id, collab);
                this.collabClientsChanged?.(collab.collabId);
            }

            console.log(`websocket client connected`);

            ws.on("error", (error) => {
                // A protocol error on a single connection (e.g. WS_ERR_INVALID_CLOSE_CODE from a
                // malformed close frame sent by a browser going to sleep) emits an "error" event on
                // this socket. Without a listener, Node's EventEmitter rethrows it as an uncaught
                // exception and crashes the whole process. Log and drop the connection instead.
                // https://github.com/TriliumNext/Trilium/issues/9598
                console.error("WebSocket connection error:", error);
                this.untrack(id);
            });

            ws.on("message", (messageJson) => {
                // A guest socket the provider let go of speaks for nobody, least of all the host.
                if (collab && !this.collabConnections.has(id)) {
                    return;
                }

                void (async () => {
                    try {
                        const message = JSON.parse(messageJson as any);

                        if (this.clientMessageHandler) {
                            await this.clientMessageHandler(id, message);
                        }
                    } catch (e) {
                        // A malformed message (invalid JSON) or a failing handler must not
                        // crash the process via an unhandled rejection on this floating promise.
                        console.error("Failed to process websocket message:", e);
                    }
                })();
            });

            ws.on("close", () => {
                this.untrack(id);
            });
        });

        this.webSocketServer.on("error", (error) => {
            // https://github.com/zadam/trilium/issues/3374#issuecomment-1341053765
            console.log(error);
        });
    }

    /**
     * Register a handler for incoming client messages.
     */
    setClientMessageHandler(handler: ClientMessageHandler) {
        this.clientMessageHandler = handler;
    }

    sendMessageToAllClients(message: WebSocketMessage): void {
        const jsonStr = JSON.stringify(message);

        if (this.webSocketServer) {
            if (shouldLogMessage(message)) {
                getLog().info(`Sending message to all clients: ${jsonStr}`);
            }

            this.webSocketServer.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN && !(client as any).collab) {
                    client.send(jsonStr);
                }
            });
        }
    }

    sendMessageToCollabClients(
        collabId: string, message: WebSocketMessage, filter?: CollabClientFilter
    ): void {
        const jsonStr = JSON.stringify(message);

        for (const client of this.webSocketServer?.clients ?? []) {
            const collab = (client as any).collab as CollabConnection | undefined;
            const passes = !filter
                || ((collab?.viewingNoteId === filter.noteId
                    || collab?.editingNoteId === filter.noteId)
                    && (client as any).id !== filter.exceptClientId);

            if (collab?.collabId === collabId && client.readyState === WebSocket.OPEN && passes) {
                client.send(jsonStr);
            }
        }
    }

    hasCollabClients(): boolean {
        return this.collabConnections.size > 0;
    }

    getCollabClients(collabId: string): CollabClientInfo[] {
        return [ ...this.collabConnections.values() ]
            .filter((connection) => connection.collabId === collabId)
            .map(({ guestId, unlocked, name, color, viewingNoteId, editingNoteId, isHost }) =>
                ({ guestId, unlocked, name, color, viewingNoteId, editingNoteId, isHost }));
    }

    getClientCollab(clientId: string): CollabConnection | null {
        return this.collabConnections.get(clientId) ?? null;
    }

    setCollabEditing(clientId: string, noteId: string | null): void {
        const connection = this.collabConnections.get(clientId);

        if (connection) {
            connection.editingNoteId = noteId;
        }
    }

    setCollabViewing(clientId: string, noteId: string | null): void {
        const connection = this.collabConnections.get(clientId);

        if (connection) {
            connection.viewingNoteId = noteId;
        }
    }

    setCollabGuestName(collabId: string, guestId: string, name: string | null): void {
        for (const connection of this.collabConnections.values()) {
            if (connection.collabId === collabId && connection.guestId === guestId) {
                connection.name = name;
            }
        }
    }

    setCollabGuestColor(collabId: string, guestId: string, color: string | null): void {
        for (const connection of this.collabConnections.values()) {
            if (connection.collabId === collabId && connection.guestId === guestId) {
                connection.color = color;
            }
        }
    }

    closeCollabClients(collabId: string): void {
        for (const [ clientId, connection ] of this.collabConnections) {
            if (connection.collabId === collabId) {
                this.clientMap.get(clientId)?.close(1000, "collaboration ended");
            }
        }
    }

    /**
     * Closes the guest's sockets and drops them from the collaboration at once, so the presence
     * that follows reaches the others but not them.
     */
    closeCollabGuest(collabId: string, guestId: string): void {
        const removed = [ ...this.collabConnections ]
            .filter(([ , connection ]) =>
                connection.collabId === collabId && connection.guestId === guestId)
            .map(([ clientId ]) => clientId);

        for (const clientId of removed) {
            this.clientMap.get(clientId)?.close(COLLAB_REMOVED_CLOSE_CODE, "removed");
        }

        for (const clientId of removed) {
            this.untrack(clientId);
        }
    }

    onCollabClientsChanged(callback: (collabId: string) => void): void {
        this.collabClientsChanged = callback;
    }

    private untrack(clientId: string) {
        const collab = this.collabConnections.get(clientId);

        this.clientMap.delete(clientId);
        this.collabConnections.delete(clientId);

        if (collab) {
            this.collabClientsChanged?.(collab.collabId);
        }
    }

    sendMessageToClient(clientId: string, message: WebSocketMessage): boolean {
        const client = this.clientMap.get(clientId);
        if (!client || client.readyState !== WebSocket.OPEN) {
            return false;
        }

        client.send(JSON.stringify(message));
        return true;
    }

    getClientCount(): number {
        return this.webSocketServer?.clients?.size ?? 0;
    }

    dispose(): void {
        this.webSocketServer?.close();
        this.clientMap.clear();
    }
}
