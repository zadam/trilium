import {
    COLLAB_HOST_PERSON_ID, type Collaboration, type CollaborationCreateMode,
    type CollaborationEditMode, type CollaborationViewMode
} from "@triliumnext/commons";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { createCursorSync, type CursorAdapter, type CursorSync } from "../../collab/cursor_sync.js";
import type FNote from "../../entities/fnote.js";
import {
    type CollabPresence, getCollabPresence, hasCollabGuests, setCollabPresence,
    subscribeToCollabPresence, subscribeToRemoteCursors
} from "../../services/collab_presence.js";
import server from "../../services/server.js";
import ws from "../../services/ws.js";
import { useTriliumEvent, useTriliumOption } from "../react/hooks.jsx";

/** What the host sends; a password left `undefined` keeps the stored one on an update. */
export interface CollaborationSettingsPayload {
    includeSubtree: boolean;
    viewMode: CollaborationViewMode;
    editMode: CollaborationEditMode;
    createMode: CollaborationCreateMode;
    slug: string | null;
    maxGuests: number;
    /** The name the host goes by on the guest pages; empty goes back to the default one. */
    hostName: string;
    viewPassword?: string;
    editPassword?: string;
    createPassword?: string;
}

export async function fetchCollaboration(noteId: string): Promise<Collaboration | null> {
    const list = await server.get<Collaboration[]>(
        `collaborations?noteId=${encodeURIComponent(noteId)}`);

    return list[0] ?? null;
}

export function createCollaboration(noteId: string, settings: CollaborationSettingsPayload) {
    return server.post<Collaboration>("collaborations", { noteId, ...settings });
}

export function updateCollaboration(collabId: string, settings: CollaborationSettingsPayload) {
    return server.patch<Collaboration>(`collaborations/${collabId}`, settings);
}

export function stopCollaboration(collabId: string) {
    return server.remove(`collaborations/${collabId}`);
}

/** The live collaboration on the note, `null` while it is private, `undefined` until known. */
export function useCollaboration(note: FNote | null | undefined): Collaboration | null | undefined {
    const [ collaboration, setCollaboration ] =
        useState<Collaboration | null | undefined>(undefined);
    const noteId = note?.noteId;

    useEffect(() => {
        if (!noteId) {
            setCollaboration(null);
            return;
        }

        let stale = false;
        setCollaboration(undefined);
        void fetchCollaboration(noteId).then((found) => {
            if (!stale) {
                setCollaboration(found);
            }
        });

        return () => {
            stale = true;
        };
    }, [ noteId ]);

    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        if (noteId && loadResults.hasCollaborationForNote(noteId)) {
            void fetchCollaboration(noteId).then(setCollaboration);
        }
    });

    return collaboration;
}

/** Who is on the collaboration's pages: asked once, then kept current by the server's messages. */
export function useCollabPresence(collabId: string | null | undefined): CollabPresence | null {
    usePresenceVersion();

    useEffect(() => {
        if (!collabId || getCollabPresence(collabId)) {
            return;
        }

        void server.get<CollabPresence>(`collaborations/${collabId}/presence`).then((presence) => {
            // A message that arrived meanwhile is the newer.
            if (!getCollabPresence(collabId)) {
                setCollabPresence(collabId, presence);
            }
        });
    }, [ collabId ]);

    return collabId ? getCollabPresence(collabId) : null;
}

/** Who is on each of the collaborations' pages, as the server last said. */
export function useCollabPresences(collabIds: readonly string[]): Map<string, CollabPresence> {
    const version = usePresenceVersion();
    const key = collabIds.join(",");

    return useMemo(() => new Map(collabIds.flatMap((collabId) => {
        const presence = getCollabPresence(collabId);

        return presence ? [ [ collabId, presence ] as const ] : [];
    })), [ version, key ]);
}

/**
 * The live collaborations whose pages show the note. The server is asked only while a guest is on
 * some collaboration's pages, and again when collaborations or the note's own branches change.
 */
export function useCollaborationsInScope(note: FNote | null | undefined): Collaboration[] {
    const [ collaborations, setCollaborations ] = useState<Collaboration[]>([]);
    const [ refreshes, setRefreshes ] = useState(0);
    usePresenceVersion();
    const anyGuests = hasCollabGuests();
    const noteId = note?.noteId;

    useEffect(() => {
        if (!noteId || !anyGuests) {
            setCollaborations([]);
            return;
        }

        let stale = false;
        void server.get<Collaboration[]>(`collaborations?inScopeOf=${encodeURIComponent(noteId)}`)
            .then((found) => {
                if (!stale) {
                    setCollaborations(found);
                }
            });

        return () => {
            stale = true;
        };
    }, [ noteId, anyGuests, refreshes ]);

    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        if (loadResults.getCollaborationRows().length > 0
                || loadResults.getBranchRows().some((branch) => branch.noteId === noteId)) {
            setRefreshes((count) => count + 1);
        }
    });

    return collaborations;
}

/** Renames someone in a collaboration's list; the host's own entry renames the host. */
export function renameCollabPerson(collabId: string, personId: string, name: string) {
    return server.put(`collaborations/${collabId}/people/${encodeURIComponent(personId)}`,
        { name });
}

/** Signs a guest out of the collaboration and closes their pages. */
export function removeCollabPerson(collabId: string, personId: string) {
    return server.remove(`collaborations/${collabId}/people/${encodeURIComponent(personId)}`);
}

/**
 * Shares the host's selection in an editor of the note with the people on the pages of the
 * collaborations that show it, and draws theirs. Off while a sync server serves the
 * collaborations, whose guests never reach this instance.
 */
export function useCollabCursors(note: FNote | null | undefined, adapter: CursorAdapter | null) {
    const collaborations = useCollaborationsInScope(note);
    const presences = useCollabPresences(collaborations.map((collab) => collab.collabId));
    const [ syncServerHost ] = useTriliumOption("syncServerHost");
    const people = useMemo(() => [ ...presences.values() ].flatMap((presence) => presence.people),
        [ presences ]);
    const peopleRef = useRef(people);
    peopleRef.current = people;
    const syncRef = useRef<CursorSync | null>(null);
    const noteId = note?.noteId;
    const shared = collaborations.length > 0 && !syncServerHost;

    useEffect(() => {
        if (!adapter || !noteId || !shared) {
            return;
        }

        const sync = createCursorSync({
            noteId,
            selfId: COLLAB_HOST_PERSON_ID,
            adapter,
            send: (message) => ws.sendOutgoing(message)
        });
        sync.setPeople(peopleRef.current);
        syncRef.current = sync;
        const stopReceiving = subscribeToRemoteCursors((message) => sync.receive(message));

        return () => {
            stopReceiving();
            sync.dispose();
            syncRef.current = null;
        };
    }, [ adapter, noteId, shared ]);

    useEffect(() => {
        syncRef.current?.setPeople(people);
    }, [ people ]);
}

/** Re-renders the component after each presence the server sends; returns how many arrived. */
function usePresenceVersion() {
    const [ version, setVersion ] = useState(0);

    useEffect(() => subscribeToCollabPresence(() => setVersion((current) => current + 1)), []);

    return version;
}
