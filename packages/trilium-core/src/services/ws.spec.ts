import {
    COLLAB_PERSON_COLORS, type EntityChange, type WebSocketMessage
} from "@triliumnext/commons";
import { t } from "i18next";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import becca from "../becca/becca.js";
import { collabPersonId, isCollabGuestRevoked } from "../collab/presence.js";
import collabService, { type CollaborationSettings } from "../collab/service.js";
import * as cls from "./context.js";
import { initMessaging } from "./messaging/index.js";
import type {
    ClientMessageHandler, CollabClientFilter, CollabClientInfo, CollabConnection
} from "./messaging/types.js";
import noteService from "./notes.js";
import protectedSessionService from "./protected_session.js";
import { getSql } from "./sql/index.js";
import dateUtils from "./utils/date.js";
import { randomString } from "./utils/index.js";
import ws from "./ws.js";

const sentAll: WebSocketMessage[] = [];
const sentToClient: Array<{ clientId: string; message: WebSocketMessage }> = [];
let clientHandler: ClientMessageHandler | undefined;

const fakeProvider = {
    sendMessageToAllClients: vi.fn((message: WebSocketMessage) => {
        sentAll.push(message);
    }),
    sendMessageToClient: vi.fn((clientId: string, message: WebSocketMessage) => {
        sentToClient.push({ clientId, message });
        return true;
    }),
    setClientMessageHandler: vi.fn((handler: ClientMessageHandler) => {
        clientHandler = handler;
    })
};

function insertEntityChange(entityName: string, entityId: string, isErased = 0): number {
    return cls.init(() => {
        getSql().execute(
            `INSERT INTO entity_changes (entityName, entityId, hash, isErased, changeId, componentId, instanceId, isSynced, utcDateChanged)
             VALUES (?, ?, 'hash', ?, ?, 'NA', 'inst', 1, ?)`,
            [entityName, entityId, isErased, randomString(12), dateUtils.utcNowDateTime()]
        );
        return getSql().getValue<number>("SELECT last_insert_rowid()") ?? 0;
    });
}

function existingEntityChangeId(entityName: string, entityId: string): number {
    const id = getSql().getValue<number>(
        "SELECT id FROM entity_changes WHERE entityName = ? AND entityId = ?",
        [entityName, entityId]
    );
    if (id == null) throw new Error(`no entity_change for ${entityName}/${entityId}`);
    return id;
}

// All entity-change ids we drive through buildFrontendUpdateMessage.
const ecIds: number[] = [];

describe("ws service (real DB)", () => {
    beforeAll(() => {
        const now = dateUtils.utcNowDateTime();
        const blobId = getSql().getValue<string>("SELECT blobId FROM blobs LIMIT 1");

        cls.init(() => {
            // Protected + plain note rows that becca does not know about (inserted via raw SQL).
            getSql().execute(
                `INSERT INTO notes (noteId, title, isProtected, type, mime, isDeleted, dateCreated, dateModified, utcDateCreated, utcDateModified)
                 VALUES ('wsProtNote', 'secret', 1, 'text', 'text/html', 0, ?, ?, ?, ?)`,
                [now, now, now, now]
            );
            getSql().execute(
                `INSERT INTO notes (noteId, title, isProtected, type, mime, isDeleted, dateCreated, dateModified, utcDateCreated, utcDateModified)
                 VALUES ('wsPlainNote', 'plain', 0, 'text', 'text/html', 0, ?, ?, ?, ?)`,
                [now, now, now, now]
            );
            // Attachments need a matching blob for the JOIN to return a row. They are
            // marked deleted so becca.getAttachment() (which filters isDeleted=0) misses
            // them, forcing the DB-fallback path in fillInAdditionalProperties (whose
            // query has no isDeleted filter).
            getSql().execute(
                `INSERT INTO attachments (attachmentId, ownerId, role, mime, title, isProtected, position, blobId, dateModified, utcDateModified, isDeleted)
                 VALUES ('wsProtAtt', 'root', 'file', 'text/plain', 'secret', 1, 0, ?, ?, ?, 1)`,
                [blobId, now, now]
            );
            getSql().execute(
                `INSERT INTO attachments (attachmentId, ownerId, role, mime, title, isProtected, position, blobId, dateModified, utcDateModified, isDeleted)
                 VALUES ('wsPlainAtt', 'root', 'file', 'text/plain', 'plain', 0, 0, ?, ?, ?, 1)`,
                [blobId, now, now]
            );
        });

        // becca-hit changes (reuse the existing fixture rows).
        const branchId = becca.getNote("root")?.getChildBranches()[0]?.branchId ?? "root_root";
        const attrEC = getSql().getRow<{ id: number; entityId: string }>(
            `SELECT ec.id, ec.entityId FROM entity_changes ec
             JOIN attributes a ON a.attributeId = ec.entityId
             WHERE ec.entityName = 'attributes' AND a.isDeleted = 0 LIMIT 1`
        );

        ecIds.push(
            existingEntityChangeId("notes", "root"), // becca-hit note
            existingEntityChangeId("branches", branchId), // becca-hit branch
            existingEntityChangeId("options", "theme"), // becca-hit option
            attrEC.id, // becca-hit attribute
            insertEntityChange("notes", "wsProtNote"), // miss -> protected note row
            insertEntityChange("notes", "wsPlainNote"), // miss -> plain note row
            insertEntityChange("notes", "wsMissingNote"), // miss -> no row
            insertEntityChange("branches", "wsFakeBranch"), // miss
            insertEntityChange("attributes", "wsFakeAttr"), // miss
            insertEntityChange("options", "wsFakeOption"), // miss
            insertEntityChange("attachments", "wsProtAtt"), // miss -> protected attachment row
            insertEntityChange("attachments", "wsPlainAtt"), // miss -> plain attachment row
            insertEntityChange("revisions", "wsRev"), // revisions: only sets noteId
            existingEntityChangeId("note_reordering", "root"), // becca-hit parent with children
            insertEntityChange("note_reordering", "wsFakeParent"), // miss parent
            insertEntityChange("notes", "wsErasedNote", 1) // erased -> early return in fillIn
        );
    });

    afterEach(() => vi.restoreAllMocks());

    it("broadcasts are no-ops before init() wires a provider", () => {
        const lengthBefore = sentAll.length;
        ws.syncFinished();
        cls.init(() => ws.sendTransactionEntityChangesToAllClients());
        expect(sentAll.length).toBe(lengthBefore);
    });

    it("init() registers a client message handler routing each message type", async () => {
        initMessaging(fakeProvider);
        ws.init();
        expect(fakeProvider.setClientMessageHandler).toHaveBeenCalled();
        expect(clientHandler).toBeTypeOf("function");

        const handler = clientHandler;
        if (!handler) throw new Error("handler not registered");

        await handler("client-1", { type: "log-error", error: "e", stack: "s" });
        await handler("client-1", { type: "log-info", info: "i" });
        await handler("client-1", { type: "ping" });
        await handler("client-1", { type: "totally-unknown" });

        expect(sentToClient).toContainEqual({ clientId: "client-1", message: { type: "ping", protectedSessionAvailable: false } });
    });

    it("ping replies report the live protected-session state", async () => {
        const handler = clientHandler;
        if (!handler) throw new Error("handler not registered");

        protectedSessionService.setDataKey(new Uint8Array([1, 2, 3]));
        try {
            await handler("client-2", { type: "ping" });
        } finally {
            protectedSessionService.resetDataKey();
        }

        expect(sentToClient).toContainEqual({ clientId: "client-2", message: { type: "ping", protectedSessionAvailable: true } });
    });

    it("sync status helpers broadcast the matching message types with lastSyncedPush", () => {
        ws.setLastSyncedPush(42);
        ws.syncPushInProgress();
        ws.syncPullInProgress();
        ws.syncFinished();
        ws.syncFailed();
        ws.syncHashCheckFailed(["blobs/9"]);
        ws.reloadFrontend("because");

        const types = sentAll.map((m) => m.type);
        expect(types).toEqual(expect.arrayContaining([
            "sync-push-in-progress",
            "sync-pull-in-progress",
            "sync-finished",
            "sync-failed",
            "sync-hash-check-failed",
            "reload-frontend"
        ]));
        const pull = sentAll.find((m) => m.type === "sync-pull-in-progress");
        expect(pull).toMatchObject({ lastSyncedPush: 42 });

        ws.syncPullInProgress({ pulled: 3, total: 10 });
        expect(sentAll.at(-1)).toEqual({
            type: "sync-pull-in-progress", lastSyncedPush: 42, progress: { pulled: 3, total: 10 }
        });
        expect(sentAll.find((m) => m.type === "sync-hash-check-failed")).toMatchObject({ sectors: ["blobs/9"] });
    });

    it("sends a ping frontend-update when there are no pending entity changes", () => {
        const before = sentAll.length;
        cls.init(() => ws.sendTransactionEntityChangesToAllClients());
        expect(sentAll[sentAll.length - 1]).toEqual({ type: "ping", protectedSessionAvailable: false });
        expect(sentAll.length).toBe(before + 1);
    });

    it("builds a frontend-update message filling in properties for every entity type", () => {
        cls.init(() => {
            cls.set("entityChangeIds", [...ecIds]);
            ws.sendTransactionEntityChangesToAllClients();
        });

        const message = sentAll[sentAll.length - 1];
        expect(message.type).toBe("frontend-update");
        if (message.type !== "frontend-update") throw new Error("expected frontend-update");

        const changes = message.data.entityChanges;
        // Every entity type should have been processed.
        const byName = new Map<string, unknown>();
        for (const c of changes) byName.set(c.entityName, c);
        expect(byName.has("notes")).toBe(true);
        expect(byName.has("branches")).toBe(true);
        expect(byName.has("attributes")).toBe(true);
        expect(byName.has("options")).toBe(true);
        expect(byName.has("attachments")).toBe(true);
        expect(byName.has("note_reordering")).toBe(true);

        // becca-hit note got its full pojo (title present).
        const rootChange = changes.find((c) => c.entityName === "notes" && c.entityId === "root");
        expect(rootChange?.entity).toMatchObject({ noteId: "root" });

        // note_reordering for root carries the child branch positions map.
        const reorder = changes.find((c) => c.entityName === "note_reordering" && c.entityId === "root");
        expect(reorder?.positions).toBeTypeOf("object");
    });

    it("swallows errors thrown while filling in a single entity change", () => {
        vi.spyOn(protectedSessionService, "decryptString").mockImplementation(() => {
            throw new Error("decrypt failed");
        });
        const protId = existingEntityChangeId("notes", "wsProtNote");

        const before = sentAll.length;
        expect(() =>
            cls.init(() => {
                cls.set("entityChangeIds", [protId]);
                ws.sendTransactionEntityChangesToAllClients();
            })
        ).not.toThrow();
        // The message is still sent despite the per-entity error.
        expect(sentAll.length).toBe(before + 1);
    });

    it("does not send when the entity changes query yields no rows", () => {
        const sql = getSql();
        vi.spyOn(sql, "getManyRows").mockReturnValueOnce(undefined as never);

        const before = sentAll.length;
        cls.init(() => {
            cls.set("entityChangeIds", [ecIds[0]]);
            ws.sendTransactionEntityChangesToAllClients();
        });
        expect(sentAll.length).toBe(before);
    });
});

describe("collaboration updates and presence", () => {
    type FakeConnection = CollabConnection & { clientId: string };

    const sentToCollab: Array<{
        collabId: string; message: WebSocketMessage; filter?: CollabClientFilter;
    }> = [];
    const connections: FakeConnection[] = [];
    let clientsChanged: ((collabId: string) => void) | undefined;
    const findConnection = (clientId: string) =>
        connections.find((connection) => connection.clientId === clientId);

    const collabProvider = {
        ...fakeProvider,
        sendMessageToCollabClients: vi.fn(
            (collabId: string, message: WebSocketMessage, filter?: CollabClientFilter) => {
                sentToCollab.push({ collabId, message, filter });
            }),
        hasCollabClients: vi.fn(() => true),
        getCollabClients: vi.fn((collabId: string) =>
            connections.filter((connection) => connection.collabId === collabId)),
        getClientCollab: vi.fn((clientId: string) => findConnection(clientId) ?? null),
        setCollabEditing: vi.fn((clientId: string, noteId: string | null) => {
            const connection = findConnection(clientId);
            if (connection) connection.editingNoteId = noteId;
        }),
        setCollabViewing: vi.fn((clientId: string, noteId: string | null) => {
            const connection = findConnection(clientId);
            if (connection) connection.viewingNoteId = noteId;
        }),
        setCollabGuestName: vi.fn((collabId: string, guestId: string, name: string | null) => {
            for (const connection of connections) {
                if (connection.collabId === collabId && connection.guestId === guestId) {
                    connection.name = name;
                }
            }
        }),
        closeCollabClients: vi.fn(),
        closeCollabGuest: vi.fn((collabId: string, guestId: string) => {
            const staying = connections.filter((connection) =>
                connection.collabId !== collabId || connection.guestId !== guestId);
            connections.splice(0, connections.length, ...staying);
            clientsChanged?.(collabId);
        }),
        onCollabClientsChanged: vi.fn((callback: (collabId: string) => void) => {
            clientsChanged = callback;
        })
    };

    function connect(clientId: string, collabId: string, fields: Partial<CollabClientInfo> = {}) {
        connections.push({
            clientId, collabId, guestId: null, unlocked: [], name: null, viewingNoteId: null,
            editingNoteId: null, isHost: false, ...fields
        });
    }

    function startCollab(noteId: string, settings: Partial<CollaborationSettings> = {}) {
        return cls.init(() => collabService.createCollaboration(noteId, {
            includeSubtree: false, viewMode: "open", editMode: "open", createMode: "none",
            ...settings
        }));
    }

    function lastPresence(collabId: string) {
        return sentAll.filter((message) => message.type === "collab-presence")
            .findLast((message) => message.collabId === collabId);
    }

    const guestName = (number: number) => t("collab_theme.guest_name", { number });

    function getHandler() {
        if (!clientHandler) throw new Error("handler not registered");
        return clientHandler;
    }

    beforeAll(() => {
        initMessaging(collabProvider);
        ws.init();
    });

    function createNote(title: string) {
        return cls.init(() => noteService.createNewNote({
            parentNoteId: "root", title, content: `<p>${title}</p>`, type: "text"
        })).note;
    }

    it("updates guests on in-scope notes only and closes them when the collab ends", async () => {
        const inside = createNote("ws-collab-inside");
        const outside = createNote("ws-collab-outside");
        const collab = await cls.init(() => collabService.createCollaboration(inside.noteId, {
            includeSubtree: true, viewMode: "open", editMode: "open", createMode: "none"
        }));
        sentToCollab.length = 0;

        cls.init(() => {
            for (const entityId of [ inside.noteId, outside.noteId ]) {
                const id = existingEntityChangeId("notes", entityId);
                cls.putEntityChange({ id } as EntityChange);
            }
            ws.sendTransactionEntityChangesToAllClients();
        });

        expect(sentToCollab).toHaveLength(1);
        expect(sentToCollab[0].collabId).toBe(collab.collabId);
        const update = sentToCollab[0].message as
            Extract<WebSocketMessage, { type: "collab-update" }>;
        expect(update.notes.map((note) => note.noteId)).toEqual([ inside.noteId ]);
        expect(update.notes[0])
            .toMatchObject({ title: "ws-collab-inside", blobId: inside.blobId, isDeleted: false });
        expect(update.treeChanged).toBe(false);

        cls.init(() => {
            collabService.stopCollaboration(collab);
            ws.sendTransactionEntityChangesToAllClients();
        });

        expect(collabProvider.closeCollabClients).toHaveBeenCalledWith(collab.collabId);
    });

    it("refreshes the guests' trees when a note's color or icon label changes", async () => {
        const parent = createNote("ws-collab-label-parent");
        const inside = cls.init(() => noteService.createNewNote({
            parentNoteId: parent.noteId, title: "ws-collab-label-inside", content: "", type: "text"
        })).note;
        const outside = createNote("ws-collab-label-outside");
        const collab = await cls.init(() => collabService.createCollaboration(inside.noteId, {
            includeSubtree: true, viewMode: "open", editMode: "none", createMode: "none"
        }));
        const treeUpdates = () => sentToCollab.filter(({ message }) =>
            message.type === "collab-update" && message.treeChanged);
        const flush = (change: () => void) => {
            sentToCollab.length = 0;
            cls.init(() => {
                change();
                ws.sendTransactionEntityChangesToAllClients();
            });
        };

        flush(() => inside.setLabel("color", "#ff0000"));
        expect(treeUpdates().map(({ collabId }) => collabId)).toEqual([ collab.collabId ]);

        // Removing it reads the deleted row from the table, since becca no longer holds it.
        flush(() => inside.removeLabel("color"));
        expect(treeUpdates()).toHaveLength(1);

        // Labels the page does not show, and notes outside the scope, change nothing for guests.
        flush(() => inside.setLabel("unrelatedLabel", "x"));
        expect(treeUpdates()).toHaveLength(0);
        flush(() => outside.setLabel("iconClass", "bx bx-star"));
        expect(treeUpdates()).toHaveLength(0);

        // An inheritable color on the note above reaches the collaboration's notes.
        flush(() => parent.addLabel("color", "#00ff00", true));
        expect(treeUpdates().map(({ collabId }) => collabId)).toEqual([ collab.collabId ]);
        flush(() => parent.addLabel("color", "#0000ff", false));
        expect(treeUpdates()).toHaveLength(0);
    });

    it("does nothing for a transaction while no guest socket is connected", () => {
        const note = createNote("ws-collab-idle");
        collabProvider.hasCollabClients.mockReturnValueOnce(false);
        sentToCollab.length = 0;

        cls.init(() => {
            const id = existingEntityChangeId("notes", note.noteId);
            cls.putEntityChange({ id } as EntityChange);
            ws.sendTransactionEntityChangesToAllClients();
        });

        expect(sentToCollab).toHaveLength(0);
    });

    it("tells guests the settings changed only when what their page offers changed", async () => {
        const note = createNote("ws-collab-access");
        const collab = await cls.init(() => collabService.createCollaboration(note.noteId, {
            includeSubtree: false, viewMode: "open", editMode: "none", createMode: "none"
        }));
        const collabId = collab.collabId ?? "";
        const settingsUpdates = (change: () => void) => {
            sentToCollab.length = 0;
            cls.init(() => {
                change();
                collab.save();
                ws.sendTransactionEntityChangesToAllClients();
            });
            return sentToCollab
                .filter(({ message }) =>
                    message.type === "collab-update" && message.settingsChanged)
                .map((sent) => sent.collabId);
        };

        // A guest's socket connects with the settings its page was rendered with.
        clientsChanged?.(collabId);

        expect(settingsUpdates(() => { collab.maxGuests = 5; })).toEqual([]);
        expect(settingsUpdates(() => { collab.slug = "ws-collab-access"; })).toEqual([]);
        expect(settingsUpdates(() => { collab.editMode = "open"; })).toEqual([ collabId ]);
        expect(settingsUpdates(() => {})).toEqual([]);
        expect(settingsUpdates(() => { collab.includeSubtree = true; })).toEqual([ collabId ]);
    });

    it("lets a guest socket say which note it shows and edits, in scope only, for the people list",
        async () => {
            const handler = getHandler();
            const inside = createNote("ws-people-inside");
            const outside = createNote("ws-people-outside");
            const collab = await startCollab(inside.noteId, { hostName: "Ada" });
            const collabId = collab.collabId ?? "";
            connect("people-1", collabId, { guestId: "g-people-1", name: "Grace" });
            connect("people-host", collabId, { isHost: true });
            sentAll.length = 0;
            sentToCollab.length = 0;
            sentToClient.length = 0;

            await handler("people-1", { type: "collab-viewing", noteId: inside.noteId });
            await handler("people-1", { type: "collab-editing", noteId: inside.noteId });
            // A note outside the scope reads as none, which the host's page already shows.
            await handler("people-host", { type: "collab-viewing", noteId: outside.noteId });

            const presence = {
                type: "collab-presence", collabId, guests: 1,
                people: [
                    {
                        id: "host", name: "Ada", color: COLLAB_PERSON_COLORS[0], isHost: true,
                        noteId: null, editing: false
                    },
                    {
                        id: collabPersonId(collabId, "g-people-1"), name: "Grace",
                        color: COLLAB_PERSON_COLORS[1], isHost: false, noteId: inside.noteId,
                        editing: true
                    }
                ]
            };
            expect(sentAll.filter((message) => message.type === "collab-presence"))
                .toHaveLength(2);
            expect(lastPresence(collabId)).toEqual(presence);
            expect(sentToCollab.at(-1)).toEqual({ collabId, message: presence });

            // A guest socket's ping gets no answer.
            await handler("people-1", { type: "ping" });
            expect(sentToClient.some((sent) => sent.clientId === "people-1")).toBe(false);
        });

    it("relays a cursor to the pages on its note and the host's app there, from editors only",
        async () => {
            const handler = getHandler();
            const note = createNote("ws-cursor-note");
            const collab = await startCollab(note.noteId);
            const collabId = collab.collabId ?? "";
            connect("cursor-1", collabId, { guestId: "g-cursor-1", viewingNoteId: note.noteId });
            connect("cursor-2", collabId, { guestId: "g-cursor-2", viewingNoteId: note.noteId });
            clientsChanged?.(collabId);
            vi.useFakeTimers();

            try {
                await handler("app-cursor", { type: "ping", collabViewing: note.noteId });
                sentToCollab.length = 0;
                sentToClient.length = 0;

                const selection = { kind: "text", anchor: [ 0, 2 ], head: [ 0, 5 ] };
                await handler("cursor-1",
                    { type: "collab-cursor", noteId: note.noteId, selection });

                const relayed = {
                    type: "collab-remote-cursor", collabId, noteId: note.noteId,
                    person: {
                        id: collabPersonId(collabId, "g-cursor-1"), name: guestName(1),
                        color: COLLAB_PERSON_COLORS[1]
                    },
                    selection
                };
                expect(sentToCollab).toEqual([ {
                    collabId, message: relayed,
                    filter: { noteId: note.noteId, exceptClientId: "cursor-1" }
                } ]);
                expect(sentToClient).toEqual([ { clientId: "app-cursor", message: relayed } ]);

                // Another note, or a selection a page could not draw, goes nowhere.
                sentToCollab.length = 0;
                await handler("cursor-1", { type: "collab-cursor", noteId: "root", selection });
                await handler("cursor-1", {
                    type: "collab-cursor", noteId: note.noteId,
                    selection: { kind: "text", anchor: [], head: [] }
                });
                expect(sentToCollab).toEqual([]);

                // With editing turned off, the guests view only, and a viewer shares nothing.
                cls.init(() => {
                    collab.editMode = "none";
                    collab.save();
                });
                await handler("cursor-2",
                    { type: "collab-cursor", noteId: note.noteId, selection });
                expect(sentToCollab).toEqual([]);
            } finally {
                await handler("app-cursor", { type: "ping", collabViewing: null });
                vi.useRealTimers();
            }
        });

    it("shows the host while the app shows a note in scope, and relays the host's cursor there",
        async () => {
            const handler = getHandler();
            const parent = createNote("ws-host-parent");
            const child = cls.init(() => noteService.createNewNote({
                parentNoteId: parent.noteId, title: "ws-host-child", content: "", type: "text"
            })).note;
            const collab = await startCollab(parent.noteId,
                { includeSubtree: true, hostName: "Ada" });
            const collabId = collab.collabId ?? "";
            const guestId = collabPersonId(collabId, "g-host-guest");
            connect("host-guest", collabId,
                { guestId: "g-host-guest", viewingNoteId: child.noteId });
            clientsChanged?.(collabId);
            vi.useFakeTimers();

            try {
                await handler("app-host", { type: "ping", collabViewing: child.noteId });
                expect(lastPresence(collabId)?.people[0]).toEqual({
                    id: "host", name: "Ada", color: COLLAB_PERSON_COLORS[0], isHost: true,
                    noteId: child.noteId, editing: true
                });

                sentToCollab.length = 0;
                const selection = { kind: "code", anchor: 4, head: 4 };
                await handler("app-host",
                    { type: "collab-cursor", noteId: child.noteId, selection });
                expect(sentToCollab).toEqual([ {
                    collabId,
                    message: {
                        type: "collab-remote-cursor", collabId, noteId: child.noteId,
                        person: { id: "host", name: "Ada", color: COLLAB_PERSON_COLORS[0] },
                        selection
                    },
                    filter: { noteId: child.noteId }
                } ]);

                // The app switching to a note outside the scope takes the host off the list.
                await handler("app-host", { type: "ping", collabViewing: "root" });
                expect(lastPresence(collabId)?.people.map((person) => person.id))
                    .toEqual([ guestId ]);

                // With no guest connected anywhere, nobody sees the host, so nothing is noted.
                collabProvider.hasCollabClients.mockReturnValueOnce(false);
                await handler("app-idle", { type: "ping", collabViewing: child.noteId });
                expect(lastPresence(collabId)?.people.map((person) => person.id))
                    .toEqual([ guestId ]);

                // So does an app whose pings stopped, five seconds after the last one.
                await handler("app-host", { type: "ping", collabViewing: parent.noteId });
                expect(lastPresence(collabId)?.people.map((person) => person.id))
                    .toEqual([ "host", guestId ]);
                vi.advanceTimersByTime(4000);
                expect(lastPresence(collabId)?.people.map((person) => person.id))
                    .toEqual([ "host", guestId ]);
                vi.advanceTimersByTime(2000);
                expect(lastPresence(collabId)?.people.map((person) => person.id))
                    .toEqual([ guestId ]);
            } finally {
                vi.useRealTimers();
            }
        });

    it("renames a guest on all their pages, and removes one, keeping them out", async () => {
        const collab = await startCollab(createNote("ws-rename").noteId);
        const collabId = collab.collabId ?? "";
        connect("rename-1", collabId, { guestId: "g-rename" });
        connect("rename-2", collabId, { guestId: "g-rename" });
        connect("rename-3", collabId, { guestId: "g-stays" });

        ws.renameCollabGuest(collabId, "g-rename", "Grace");
        expect(connections.filter((connection) => connection.guestId === "g-rename")
            .map((connection) => connection.name)).toEqual([ "Grace", "Grace" ]);
        expect(lastPresence(collabId)?.people.map((person) => person.name))
            .toEqual([ "Grace", guestName(2) ]);

        ws.removeCollabGuest(collabId, "g-rename");
        expect(collabProvider.closeCollabGuest).toHaveBeenCalledWith(collabId, "g-rename");
        expect(isCollabGuestRevoked(collabId, "g-rename")).toBe(true);
        expect(lastPresence(collabId)?.people.map((person) => person.id))
            .toEqual([ collabPersonId(collabId, "g-stays") ]);
    });

    it("counts a seated guest once, the host never, and fills up at the limit", async () => {
        const note = createNote("ws-collab-limit");
        const collab = await cls.init(() => collabService.createCollaboration(note.noteId, {
            includeSubtree: false, viewMode: "open", editMode: "none", createMode: "none",
            maxGuests: 2
        }));

        const collabId = collab.collabId ?? "";
        connections.length = 0;
        connect("seat-1", collabId, { guestId: "g1" });
        connect("seat-2", collabId, { guestId: "g1", editingNoteId: "n1" });
        connect("seat-host", collabId, { isHost: true });
        expect(ws.countGuestConnections(collabId)).toBe(1);
        expect(ws.getCollabPresence(collabId).guests).toBe(1);
        expect(ws.isCollabFull(collab, null)).toBe(false);

        connect("seat-anonymous", collabId);
        expect(ws.countGuestConnections(collabId)).toBe(2);
        expect(ws.isCollabFull(collab, null)).toBe(true);
        expect(ws.isCollabFull(collab, "g2")).toBe(true);
        expect(ws.isCollabFull(collab, "g1")).toBe(false);

        connections.length = 0;
    });
});
