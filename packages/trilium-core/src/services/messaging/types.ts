import type { EntityChange, WebSocketMessage } from "@triliumnext/commons";

import type { GuestCapability } from "../context.js";

/**
 * Handler function for incoming messages from clients.
 */
export type MessageHandler = (message: WebSocketMessage) => void | Promise<void>;

/**
 * Represents a connected client that can receive messages.
 */
export interface MessageClient {
    /** Unique identifier for this client */
    readonly id: string;
    /** Send a message to this specific client */
    send(message: WebSocketMessage): void;
    /** Check if the client is still connected */
    isConnected(): boolean;
}

/**
 * Provider interface for server-to-client messaging.
 *
 * This abstraction allows different transport mechanisms:
 * - WebSocket for traditional server environments
 * - Worker postMessage for browser environments
 * - Mock implementations for testing
 */
/**
 * Handler for incoming client messages. Receives the client ID and the raw parsed message.
 * The message is typed as `any` because clients may send message types (e.g. "log-error",
 * "log-info") that aren't part of the server's WebSocketMessage union.
 */
export type ClientMessageHandler = (clientId: string, message: any) => void | Promise<void>;

/** What a guest socket of a collaboration reports about itself. */
export interface CollabClientInfo {
    /** The session's guest id; null for the host's own session, which holds no grant. */
    guestId: string | null;
    /**
     * The capabilities the session unlocked with a password when the socket connected. What the
     * guest holds also takes the open capabilities, as the collaboration has them at the time.
     */
    unlocked: readonly GuestCapability[];
    /** The name the guest chose, or null for their numbered default. */
    name: string | null;
    /** The color the guest chose from the palette, or null for their numbered default. */
    color: string | null;
    /** The note the page said it shows, or null. */
    viewingNoteId: string | null;
    /** The note the guest said it is editing, or null. */
    editingNoteId: string | null;
    /** True for the host's own logged-in session looking at the page, which no limit counts. */
    isHost: boolean;
}

export interface CollabConnection extends CollabClientInfo {
    collabId: string;
}

/** Narrows a message to a collaboration's pages on one note, leaving out the one that sent it. */
export interface CollabClientFilter {
    noteId: string;
    exceptClientId?: string;
}

export interface MessagingProvider {
    /**
     * Send a message to all connected clients.
     * This is the primary method used by core services like TaskContext.
     */
    sendMessageToAllClients(message: WebSocketMessage): void;

    /**
     * Send a message to a specific client by ID.
     * Returns false if the client is not found or disconnected.
     */
    sendMessageToClient(clientId: string, message: WebSocketMessage): boolean;

    /**
     * Register a handler for incoming client messages.
     */
    setClientMessageHandler(handler: ClientMessageHandler): void;

    /**
     * Subscribe to incoming messages from clients.
     * Returns an unsubscribe function.
     */
    onMessage?(handler: MessageHandler): () => void;

    /**
     * Get the number of connected clients.
     */
    getClientCount?(): number;

    /**
     * Guest sockets of collaborations. A provider that serves none leaves these out; the host's
     * broadcasts never reach a guest socket, and a guest socket only ever receives these.
     */
    sendMessageToCollabClients?(
        collabId: string, message: WebSocketMessage, filter?: CollabClientFilter): void;
    /** Whether any guest socket is connected at all, so a transaction can skip the collab work. */
    hasCollabClients?(): boolean;
    getCollabClients?(collabId: string): CollabClientInfo[];
    getClientCollab?(clientId: string): CollabConnection | null;
    setCollabEditing?(clientId: string, noteId: string | null): void;
    setCollabViewing?(clientId: string, noteId: string | null): void;
    /** Renames the guest on every socket of theirs in the collaboration. */
    setCollabGuestName?(collabId: string, guestId: string, name: string | null): void;
    /** Recolors the guest on every socket of theirs in the collaboration. */
    setCollabGuestColor?(collabId: string, guestId: string, color: string | null): void;
    /** Disconnects a collaboration's guests, after the host ended it. */
    closeCollabClients?(collabId: string): void;
    /** Disconnects one guest's sockets of the collaboration, after the host removed them. */
    closeCollabGuest?(collabId: string, guestId: string): void;
    /** Registers the callback run when a collaboration's guest sockets connect or disconnect. */
    onCollabClientsChanged?(callback: (collabId: string) => void): void;

    /**
     * Called when the provider should clean up resources.
     */
    dispose?(): void;
}

/**
 * Extended interface for server-side messaging with entity change support.
 * This is used by the WebSocket implementation to handle entity sync.
 */
export interface ServerMessagingProvider extends MessagingProvider {
    /**
     * Send entity changes to all clients (for frontend-update messages).
     */
    sendEntityChangesToAllClients(entityChanges: EntityChange[]): void;

    /**
     * Set the last synced push ID for sync status messages.
     */
    setLastSyncedPush(entityChangeId: number): void;

    /**
     * Notify clients that sync pull is in progress.
     */
    syncPullInProgress(): void;

    /**
     * Notify clients that sync push is in progress.
     */
    syncPushInProgress(): void;

    /**
     * Notify clients that sync has finished.
     */
    syncFinished(): void;

    /**
     * Notify clients that sync has failed.
     */
    syncFailed(): void;

    /**
     * Request all clients to reload their frontend.
     */
    reloadFrontend(reason: string): void;
}
