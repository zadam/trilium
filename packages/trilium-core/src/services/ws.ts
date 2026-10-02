import {
    COLLAB_HOST_PERSON_ID, COLLAB_PERSON_COLORS, type CollabCursorOwner, type CollabPerson,
    type CollabSelection, type EntityChange, parseCollabSelection, type SyncPullProgress,
    WebSocketMessage
} from "@triliumnext/commons";

import becca from "../becca/becca.js";
import type BCollaboration from "../becca/entities/bcollaboration.js";
import type BNote from "../becca/entities/bnote.js";
import {
    allowCursorMessage, buildCollabPeople, collabPersonId, expireHostViews, forgetCollaboration,
    getHostViewers, hasHostViews, recordHostView, revokeCollabGuest
} from "../collab/presence.js";
import {
    getAccessSignature, getCollaborationsForNote, getEffectiveCapabilities, getHostDisplayName,
    isNoteInCollabScope
} from "../collab/service.js";
import * as cls from "./context.js";
import { getLog } from "./log.js";
import protectedSessionService from "./protected_session.js";
import syncMutexService from "./sync_mutex.js";
import { getSql } from "./sql/index.js";
import { getMessagingProvider, MessagingProvider } from "./messaging/index.js";
import type { CollabConnection } from "./messaging/types.js";
import AbstractBeccaEntity from "../becca/entities/abstract_becca_entity.js";

let messagingProvider!: MessagingProvider;
let lastSyncedPush: number;

/**
 * The access signature of each collaboration as its open pages were rendered, so a settings change
 * reloads those pages only when it changes what they offer. A guest's socket connecting records it.
 */
const pageAccessSignatures = new Map<string, string>();
/** Each collaboration's people as last sent, so a cursor names its sender without a rebuild. */
const collabPeople = new Map<string, CollabPerson[]>();
let hostViewTimer: ReturnType<typeof setTimeout> | null = null;

function init() {
    messagingProvider = getMessagingProvider();

    messagingProvider.setClientMessageHandler(async (clientId, message: any) => {
        const log = getLog();
        const guest = messagingProvider.getClientCollab?.(clientId) ?? null;

        // A guest socket says where its page is and nothing else.
        if (guest) {
            handleGuestMessage(clientId, guest, message);
            return;
        }

        if (message.type === "log-error") {
            log.info(`JS Error: ${message.error}\r\nStack: ${message.stack}`);
        } else if (message.type === "log-info") {
            log.info(`JS Info: ${message.info}`);
        } else if (message.type === "ping") {
            recordHostPing(clientId, message.collabViewing);
            await syncMutexService.doExclusively(() => {
                messagingProvider.sendMessageToClient(clientId, buildPingMessage());
            });
        } else if (message.type === "collab-cursor") {
            relayHostCursor(clientId, message);
        } else {
            log.error("Unrecognized message: ");
            log.error(message);
        }
    });

    messagingProvider.onCollabClientsChanged?.((collabId) => {
        const collab = becca.getCollaboration(collabId);

        if (collab && !collab.isDeleted) {
            pageAccessSignatures.set(collabId, getAccessSignature(collab));
        }

        broadcastCollabPresence(collabId);
    });
}

function sendMessageToAllClients(message: WebSocketMessage) {
    if (messagingProvider) {
        messagingProvider.sendMessageToAllClients(message);
    }
}

function fillInAdditionalProperties(entityChange: EntityChange) {
    if (entityChange.isErased) {
        return;
    }

    // fill in some extra data needed by the frontend
    // first try to use becca, which works for non-deleted entities
    // only when that fails, try to load from the database
    const sql = getSql();
    if (entityChange.entityName === "attributes") {
        entityChange.entity = becca.getAttribute(entityChange.entityId);

        if (!entityChange.entity) {
            entityChange.entity = sql.getRow(/*sql*/`SELECT * FROM attributes WHERE attributeId = ?`, [entityChange.entityId]);
        }
    } else if (entityChange.entityName === "branches") {
        entityChange.entity = becca.getBranch(entityChange.entityId);

        if (!entityChange.entity) {
            entityChange.entity = sql.getRow(/*sql*/`SELECT * FROM branches WHERE branchId = ?`, [entityChange.entityId]);
        }
    } else if (entityChange.entityName === "notes") {
        entityChange.entity = becca.getNote(entityChange.entityId);

        if (!entityChange.entity) {
            entityChange.entity = sql.getRow(/*sql*/`SELECT * FROM notes WHERE noteId = ?`, [entityChange.entityId]);

            if (entityChange.entity?.isProtected) {
                entityChange.entity.title = protectedSessionService.decryptString(entityChange.entity.title || "");
            }
        }
    } else if (entityChange.entityName === "revisions") {
        entityChange.noteId = sql.getValue<string>(
            /*sql*/`SELECT noteId
                                                    FROM revisions
                                                    WHERE revisionId = ?`,
            [entityChange.entityId]
        );
    } else if (entityChange.entityName === "collaborations") {
        // The host's client only needs to know which note changed; the hashes stay on the server.
        entityChange.noteId = becca.getCollaboration(entityChange.entityId)?.noteId
            ?? sql.getValue<string>(
                /*sql*/`SELECT noteId FROM collaborations WHERE collabId = ?`,
                [ entityChange.entityId ]
            );
    } else if (entityChange.entityName === "note_reordering") {
        entityChange.positions = {};

        const parentNote = becca.getNote(entityChange.entityId);

        if (parentNote) {
            for (const childBranch of parentNote.getChildBranches()) {
                if (childBranch?.branchId) {
                    entityChange.positions[childBranch.branchId] = childBranch.notePosition;
                }
            }
        }
    } else if (entityChange.entityName === "options") {
        entityChange.entity = becca.getOption(entityChange.entityId);

        if (!entityChange.entity) {
            entityChange.entity = sql.getRow(/*sql*/`SELECT * FROM options WHERE name = ?`, [entityChange.entityId]);
        }
    } else if (entityChange.entityName === "attachments") {
        entityChange.entity = becca.getAttachment(entityChange.entityId);

        if (!entityChange.entity) {
            entityChange.entity = sql.getRow(
                /*sql*/`SELECT attachments.*, LENGTH(blobs.content) AS contentLength
                                                    FROM attachments
                                                    JOIN blobs USING (blobId)
                                                    WHERE attachmentId = ?`,
                [entityChange.entityId]
            );

            if (entityChange.entity?.isProtected) {
                entityChange.entity.title = protectedSessionService.decryptString(entityChange.entity.title || "");
            }
        }
    }

    if (entityChange.entity instanceof AbstractBeccaEntity) {
        entityChange.entity = entityChange.entity.getPojo();
    }
}

// entities with higher number can reference the entities with lower number
const ORDERING: Record<string, number> = {
    etapi_tokens: 0,
    attributes: 2,
    branches: 2,
    blobs: 0,
    note_reordering: 2,
    revisions: 2,
    attachments: 3,
    collaborations: 2,
    notes: 1,
    options: 0,
};

/**
 * Server→client pings carry the live protected-session state so a client whose `reload-frontend`
 * broadcast got lost (dead WebSocket at expiry time) can still detect the expiry and reload.
 */
function buildPingMessage(): WebSocketMessage {
    return {
        type: "ping",
        protectedSessionAvailable: protectedSessionService.isProtectedSessionAvailable()
    };
}

function buildFrontendUpdateMessage(entityChangeIds: number[]): WebSocketMessage | null {
    if (entityChangeIds.length === 0) {
        return buildPingMessage();
    }

    const entityChanges = getSql().getManyRows<EntityChange>(/*sql*/`SELECT * FROM entity_changes WHERE id IN (???)`, entityChangeIds);
    if (!entityChanges) {
        return null;
    }

    // sort entity changes since froca expects "referential order", i.e. referenced entities should already exist
    // in froca.
    // Froca needs this since it is an incomplete copy, it can't create "skeletons" like becca.
    entityChanges.sort((a, b) => ORDERING[a.entityName] - ORDERING[b.entityName]);

    for (const entityChange of entityChanges) {
        try {
            fillInAdditionalProperties(entityChange);
        } catch (e: any) {
            getLog().error(`Could not fill additional properties for entity change ${JSON.stringify(entityChange)} because of error: ${e.message}: ${e.stack}`);
        }
    }

    return {
        type: "frontend-update",
        data: {
            lastSyncedPush,
            entityChanges
        }
    };
}

function sendTransactionEntityChangesToAllClients() {
    if (messagingProvider) {
        const entityChangeIds = cls.getAndClearEntityChangeIds();
        const message = buildFrontendUpdateMessage(entityChangeIds);

        if (message) {
            messagingProvider.sendMessageToAllClients(message);
        }

        sendCollabUpdates(entityChangeIds);
    }
}

type CollabUpdateMessage = Extract<WebSocketMessage, { type: "collab-update" }>;

/**
 * Tells each collaboration's guests what the transaction changed inside their scope. Built from
 * becca rather than {@link fillInAdditionalProperties}, which decrypts protected titles; the scope
 * predicate never admits a protected note. A deleted collaboration disconnects its guests.
 */
function sendCollabUpdates(entityChangeIds: number[]) {
    if (entityChangeIds.length === 0 || !messagingProvider.sendMessageToCollabClients
            || !messagingProvider.hasCollabClients?.()) {
        return;
    }

    const changes = getSql().getManyRows<EntityChange>(
        /*sql*/`SELECT * FROM entity_changes WHERE id IN (???)`, entityChangeIds);
    const updates = new Map<string, CollabUpdateMessage>();
    const liveCollabs = becca.getCollaborations().filter((collab) => !collab.isDeleted);

    const updateFor = (collab: BCollaboration): CollabUpdateMessage => {
        const collabId = collab.collabId ?? "";
        let update = updates.get(collabId);

        if (!update) {
            update = {
                type: "collab-update",
                collabId,
                notes: [],
                treeChanged: false,
                settingsChanged: false
            };
            updates.set(collabId, update);
        }

        return update;
    };
    const markTreeChanged = (notes: (BNote | null)[]) => {
        for (const note of notes) {
            if (!note) {
                continue;
            }

            for (const collab of getCollaborationsForNote(note)) {
                updateFor(collab).treeChanged = true;
            }
        }
    };
    // A note or branch becca no longer holds was deleted; its scope is unknown now.
    const markEveryTreeChanged = () => {
        for (const collab of liveCollabs) {
            updateFor(collab).treeChanged = true;
        }
    };

    for (const change of changes) {
        if (change.isErased) {
            continue;
        }

        if (change.entityName === "notes") {
            const note = becca.getNote(change.entityId);

            if (!note) {
                markEveryTreeChanged();
                continue;
            }

            for (const collab of getCollaborationsForNote(note)) {
                updateFor(collab).notes.push({
                    noteId: note.noteId,
                    title: note.title,
                    type: note.type,
                    mime: note.mime,
                    blobId: note.blobId ?? null,
                    utcDateModified: note.utcDateModified ?? note.utcDateCreated,
                    isDeleted: note.isDeleted,
                    componentId: change.componentId ?? ""
                });
            }
        } else if (change.entityName === "branches") {
            const branch = becca.getBranch(change.entityId);

            if (!branch) {
                markEveryTreeChanged();
            } else {
                markTreeChanged([
                    becca.getNote(branch.parentNoteId), becca.getNote(branch.noteId)
                ]);
            }
        } else if (change.entityName === "note_reordering") {
            markTreeChanged([ becca.getNote(change.entityId) ]);
        } else if (change.entityName === "attributes") {
            // Becca drops a deleted label, so the row is read from the table.
            const attribute = getSql().getRowOrNull<AttributeAppearanceRow>(
                /*sql*/`SELECT noteId, type, name, isInheritable
                        FROM attributes WHERE attributeId = ?`,
                [ change.entityId ]);

            if (attribute?.type !== "label" || !GUEST_VISIBLE_LABELS.has(attribute.name)) {
                continue;
            }

            const note = becca.getNote(attribute.noteId);
            markTreeChanged([ note ]);

            // An inheritable label on a note above a collaboration reaches its notes too.
            if (note && attribute.isInheritable) {
                for (const collab of liveCollabs) {
                    if (becca.getNote(collab.noteId)?.hasAncestor(note.noteId)) {
                        updateFor(collab).treeChanged = true;
                    }
                }
            }
        } else if (change.entityName === "collaborations") {
            const collab = becca.getCollaboration(change.entityId);

            if (!collab || collab.isDeleted) {
                pageAccessSignatures.delete(change.entityId);
                collabPeople.delete(change.entityId);
                forgetCollaboration(change.entityId);
                messagingProvider.closeCollabClients?.(change.entityId);
                continue;
            }

            if (pageAccessSignatures.get(change.entityId) !== getAccessSignature(collab)) {
                pageAccessSignatures.set(change.entityId, getAccessSignature(collab));
                updateFor(collab).settingsChanged = true;
            }

            // The host's name is in the list of people.
            broadcastCollabPresence(change.entityId);
        }
    }

    for (const [ collabId, update ] of updates) {
        messagingProvider.sendMessageToCollabClients(collabId, update);
    }
}

/**
 * How many guests hold a socket on the collaboration: a guest with a session counts once however
 * many tabs it has, a guest without one counts per socket, and the host's own sockets never count.
 */
function countGuestConnections(collabId: string): number {
    const seated = new Set<string>();
    let anonymous = 0;

    for (const client of messagingProvider?.getCollabClients?.(collabId) ?? []) {
        if (client.isHost) {
            continue;
        }

        if (client.guestId) {
            seated.add(client.guestId);
        } else {
            anonymous++;
        }
    }

    return seated.size + anonymous;
}

/**
 * Whether the collaboration has no room for the guest: a guest whose session already holds a
 * socket keeps its seat, any other needs the connection count below `maxGuests`.
 */
function isCollabFull(collab: BCollaboration, guestId: string | null): boolean {
    const clients = messagingProvider?.getCollabClients?.(collab.collabId ?? "") ?? [];

    if (guestId && clients.some((client) => client.guestId === guestId)) {
        return false;
    }

    return countGuestConnections(collab.collabId ?? "") >= collab.maxGuests;
}

/** The labels a guest page shows: a note's color and icon. */
const GUEST_VISIBLE_LABELS = new Set([ "color", "iconClass" ]);

interface AttributeAppearanceRow {
    noteId: string;
    type: string;
    name: string;
    isInheritable: number;
}

/** Who is on a collaboration's pages now, from its sockets and the host's app. */
function getCollabPresence(collabId: string) {
    const clients = messagingProvider?.getCollabClients?.(collabId) ?? [];
    const collab = becca.getCollaboration(collabId);
    const people = collab && !collab.isDeleted ? buildCollabPeople(collab, clients) : [];

    collabPeople.set(collabId, people);

    return { guests: countGuestConnections(collabId), people };
}

/** Tells a collaboration's guests, and the host's clients, who is on its pages. */
function broadcastCollabPresence(collabId: string) {
    if (!messagingProvider) {
        return;
    }

    const message: WebSocketMessage = {
        type: "collab-presence", collabId, ...getCollabPresence(collabId)
    };

    messagingProvider.sendMessageToCollabClients?.(collabId, message);
    messagingProvider.sendMessageToAllClients(message);
}

/** What a guest socket can say: the note its page shows and edits, and its selection there. */
function handleGuestMessage(clientId: string, guest: CollabConnection, message: any) {
    const collab = becca.getCollaboration(guest.collabId);

    if (!collab || collab.isDeleted) {
        return;
    }

    if (message.type === "collab-viewing" || message.type === "collab-editing") {
        const noteId = getScopedNoteId(collab, message.noteId);
        const viewing = message.type === "collab-viewing";

        if (noteId !== (viewing ? guest.viewingNoteId : guest.editingNoteId)) {
            if (viewing) {
                messagingProvider.setCollabViewing?.(clientId, noteId);
            } else {
                messagingProvider.setCollabEditing?.(clientId, noteId);
            }

            broadcastCollabPresence(guest.collabId);
        }
    } else if (message.type === "collab-cursor" && canShareSelection(collab, guest)) {
        const personId = guest.isHost
            ? COLLAB_HOST_PERSON_ID
            : collabPersonId(guest.collabId, guest.guestId ?? "");
        const known = collabPeople.get(guest.collabId)?.find((person) => person.id === personId);
        const person = known
            ?? getCollabPresence(guest.collabId).people.find((entry) => entry.id === personId);

        if (person && allowCursorMessage(clientId)) {
            relayCursor(collab, message, person, clientId);
        }
    }
}

/** The host's page, and a guest who can edit now, share their selection; viewers never do. */
function canShareSelection(collab: BCollaboration, guest: CollabConnection) {
    return guest.isHost || (!!guest.guestId
        && getEffectiveCapabilities(collab, guest.unlocked).includes("edit"));
}

/**
 * The note the host's app shows, from its ping, so the people lists show the host there. Nobody
 * sees the host while no guest is connected, so the pings are ignored until one is.
 */
function recordHostPing(clientId: string, collabViewing: unknown) {
    if (collabViewing === undefined || !messagingProvider.hasCollabClients?.()) {
        return;
    }

    const noteId = typeof collabViewing === "string" ? collabViewing : null;

    broadcastPresenceForNotes(recordHostView(clientId, noteId));
    expireHostViewsLater();
}

/** Checks each second for app views whose pings stopped, for as long as there are any. */
function expireHostViewsLater() {
    if (!hasHostViews()) {
        clearTimeout(hostViewTimer ?? undefined);
        hostViewTimer = null;
        return;
    }

    if (hostViewTimer) {
        return;
    }

    hostViewTimer = setTimeout(() => {
        hostViewTimer = null;
        broadcastPresenceForNotes(expireHostViews());
        expireHostViewsLater();
    }, 1000);
}

/** The host's selection in the app, for the pages of every collaboration that holds the note. */
function relayHostCursor(clientId: string, message: any) {
    const note = typeof message.noteId === "string" ? becca.getNote(message.noteId) : null;

    if (!note || !messagingProvider.hasCollabClients?.() || !allowCursorMessage(clientId)) {
        return;
    }

    for (const collab of getCollaborationsForNote(note)) {
        relayCursor(collab, message, {
            id: COLLAB_HOST_PERSON_ID,
            name: getHostDisplayName(collab),
            color: COLLAB_PERSON_COLORS[0]
        });
    }
}

/**
 * Sends a selection on to the collaboration's pages on its note, other than the sender's, and to
 * the host's app clients that show the note, unless the host sent it. A note outside the scope or
 * a selection a page could not draw goes nowhere.
 */
function relayCursor(
    collab: BCollaboration, message: { noteId?: unknown; selection?: unknown },
    owner: CollabCursorOwner, senderClientId?: string
) {
    const noteId = getScopedNoteId(collab, message.noteId);
    const selection: CollabSelection | null = message.selection === null
        ? null
        : parseCollabSelection(message.selection);

    if (!noteId || (message.selection !== null && !selection)) {
        return;
    }

    const collabId = collab.collabId ?? "";
    const relayed: WebSocketMessage = {
        type: "collab-remote-cursor",
        collabId,
        noteId,
        person: { id: owner.id, name: owner.name, color: owner.color },
        selection
    };

    messagingProvider.sendMessageToCollabClients?.(collabId, relayed,
        { noteId, exceptClientId: senderClientId });

    if (owner.id !== COLLAB_HOST_PERSON_ID) {
        for (const appClientId of getHostViewers(noteId)) {
            messagingProvider.sendMessageToClient(appClientId, relayed);
        }
    }
}

/** Sends presence for each collaboration that holds one of the notes and has guests now. */
function broadcastPresenceForNotes(noteIds: readonly string[]) {
    const collabIds = new Set<string>();

    for (const noteId of noteIds) {
        const note = becca.getNote(noteId);

        for (const collab of note ? getCollaborationsForNote(note) : []) {
            collabIds.add(collab.collabId ?? "");
        }
    }

    for (const collabId of collabIds) {
        if (messagingProvider.getCollabClients?.(collabId).length) {
            broadcastCollabPresence(collabId);
        }
    }
}

/** Returns the note id when it names a note in the collaboration's scope, otherwise null. */
function getScopedNoteId(collab: BCollaboration, noteId: unknown): string | null {
    const note = typeof noteId === "string" ? becca.getNote(noteId) : null;

    return note && isNoteInCollabScope(collab, note) ? note.noteId : null;
}

/** The guest behind a person of the collaboration's list, while a page of theirs is connected. */
function findCollabGuestId(collabId: string, personId: string): string | null {
    for (const client of messagingProvider?.getCollabClients?.(collabId) ?? []) {
        if (!client.isHost && client.guestId
                && collabPersonId(collabId, client.guestId) === personId) {
            return client.guestId;
        }
    }

    return null;
}

/** Renames a guest on their open pages, once the server stored the name in their grant. */
function renameCollabGuest(collabId: string, guestId: string, name: string | null) {
    messagingProvider?.setCollabGuestName?.(collabId, guestId, name);
    broadcastCollabPresence(collabId);
}

/** Disconnects a guest the host removed and keeps them out of the collaboration from now on. */
function removeCollabGuest(collabId: string, guestId: string) {
    revokeCollabGuest(collabId, guestId);
    messagingProvider?.closeCollabGuest?.(collabId, guestId);
}

function syncPullInProgress(progress?: SyncPullProgress) {
    sendMessageToAllClients({ type: "sync-pull-in-progress", lastSyncedPush, ...(progress && { progress }) });
}

function syncPushInProgress() {
    sendMessageToAllClients({ type: "sync-push-in-progress", lastSyncedPush });
}

function syncFinished() {
    sendMessageToAllClients({ type: "sync-finished", lastSyncedPush });
}

function syncFailed() {
    sendMessageToAllClients({ type: "sync-failed", lastSyncedPush });
}

/**
 * Tells the user that syncing has stopped because the given sectors kept diverging from the sync
 * server's, which no amount of retrying will fix. The sync status icon only ever shows a generic
 * failure (indistinguishable from an unreachable server), so this state — which needs the user to
 * act — is raised as a notification of its own.
 */
function syncHashCheckFailed(sectors: string[]) {
    sendMessageToAllClients({ type: "sync-hash-check-failed", sectors });
}

function reloadFrontend(reason: string) {
    sendMessageToAllClients({ type: "reload-frontend", reason });
}

function setLastSyncedPush(entityChangeId: number) {
    lastSyncedPush = entityChangeId;
}

export default {
    init,
    sendMessageToAllClients,
    syncPushInProgress,
    syncPullInProgress,
    syncFinished,
    syncFailed,
    syncHashCheckFailed,
    sendTransactionEntityChangesToAllClients,
    broadcastCollabPresence,
    countGuestConnections,
    getCollabPresence,
    isCollabFull,
    findCollabGuestId,
    renameCollabGuest,
    removeCollabGuest,
    setLastSyncedPush,
    reloadFrontend
};
