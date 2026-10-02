import type { CollabPerson } from "@triliumnext/commons";

import type { RemoteCursorMessage } from "../collab/cursor_sync.js";

/** Who is on a collaboration's pages, as the server last said. */
export interface CollabPresence {
    /** How many guests are connected, counted as the guest limit counts them. */
    guests: number;
    people: CollabPerson[];
}

const presences = new Map<string, CollabPresence>();
const presenceListeners = new Set<() => void>();
const cursorListeners = new Set<(message: RemoteCursorMessage) => void>();

/** Keeps the collaboration's presence from the server, and tells the widgets that follow it. */
export function setCollabPresence(collabId: string, presence: CollabPresence) {
    presences.set(collabId, presence);

    for (const listener of presenceListeners) {
        listener();
    }
}

export function getCollabPresence(collabId: string): CollabPresence | null {
    return presences.get(collabId) ?? null;
}

/**
 * Whether a guest is on any collaboration's pages now. Until one is, nothing in the app needs to
 * know which collaborations a note is in.
 */
export function hasCollabGuests(): boolean {
    return [ ...presences.values() ].some(({ people }) => people.some((person) => !person.isHost));
}

/** Calls the listener after each presence the server sends; returns what stops it. */
export function subscribeToCollabPresence(listener: () => void): () => void {
    presenceListeners.add(listener);

    return () => presenceListeners.delete(listener);
}

/** Hands a selection another person shared to the editors that follow the cursors. */
export function publishRemoteCursor(message: RemoteCursorMessage) {
    for (const listener of cursorListeners) {
        listener(message);
    }
}

export function subscribeToRemoteCursors(
    listener: (message: RemoteCursorMessage) => void
): () => void {
    cursorListeners.add(listener);

    return () => cursorListeners.delete(listener);
}
