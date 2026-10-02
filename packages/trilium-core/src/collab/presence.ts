import {
    COLLAB_HOST_PERSON_ID, COLLAB_PERSON_COLORS, type CollabPerson
} from "@triliumnext/commons";
import { t } from "i18next";

import becca from "../becca/becca.js";
import type BCollaboration from "../becca/entities/bcollaboration.js";
import type { CollabClientInfo } from "../services/messaging/types.js";
import { hash } from "../services/utils/index.js";
import { getHostColor, getHostDisplayName, isNoteInCollabScope } from "./service.js";

/** How long a guest keeps their number after their last page closed, so a reload keeps it. */
const NUMBER_KEPT_MS = 2 * 60 * 1000;
/** How long the host counts as on a note after the app's last ping that named it. */
export const HOST_VIEW_TTL_MS = 5000;
/** How many cursor messages one client can send in a second. */
const CURSOR_MESSAGES_PER_SECOND = 20;

interface GuestNumber {
    number: number;
    /** When the guest's last page closed, or null while one is open. */
    leftAt: number | null;
}

interface HostView {
    noteId: string;
    lastSeen: number;
}

/** The guests' numbers by collaboration, then by guest id. */
const guestNumbers = new Map<string, Map<string, GuestNumber>>();
/** The note each of the host's app clients shows, by client id. */
const hostViews = new Map<string, HostView>();
/** The guests the host removed, as `collabId:guestId`. */
const revokedGuests = new Set<string>();
const cursorWindows = new Map<string, { start: number; count: number }>();

/**
 * Lists who is on the collaboration's pages: the host while a page of theirs or the app shows a
 * note in scope, then each guest once, however many pages they have open, by their number.
 */
export function buildCollabPeople(
    collab: BCollaboration, clients: readonly CollabClientInfo[], now = Date.now()
): CollabPerson[] {
    const people: CollabPerson[] = [];
    const host = buildHost(collab, clients.filter((client) => client.isHost), now);
    const pagesByGuest = new Map<string, CollabClientInfo[]>();

    if (host) {
        people.push(host);
    }

    for (const client of clients) {
        if (!client.isHost && client.guestId) {
            pagesByGuest.set(client.guestId, [ ...pagesByGuest.get(client.guestId) ?? [], client ]);
        }
    }

    const collabId = collab.collabId ?? "";
    const numbers = trackGuestNumbers(collabId, [ ...pagesByGuest.keys() ], now);
    const guests = [ ...pagesByGuest ]
        .map(([ guestId, pages ]) => ({ guestId, pages, number: numbers.get(guestId) ?? 0 }))
        .sort((a, b) => a.number - b.number);

    for (const { guestId, pages, number } of guests) {
        people.push({
            id: collabPersonId(collabId, guestId),
            name: pages.find((page) => page.name)?.name ?? t("collab_theme.guest_name", { number }),
            color: pages.find((page) => page.color)?.color
                ?? COLLAB_PERSON_COLORS[1 + (number - 1) % (COLLAB_PERSON_COLORS.length - 1)],
            isHost: false,
            ...describePages(pages)
        });
    }

    return people;
}

/**
 * The id a guest has in a collaboration's list of people: the same across their reloads, different
 * in each collaboration, and never their guest id, which only their session holds.
 */
export function collabPersonId(collabId: string, guestId: string): string {
    return hash(`collab-person:${collabId}:${guestId}`)
        .replace(/\+/g, "-").replace(/\//g, "_").slice(0, 16);
}

/**
 * Records the note the host's app shows, from its ping, or that it shows none. Returns the notes
 * whose people lists change: the one the host left and the one the host arrived on.
 */
export function recordHostView(
    clientId: string, noteId: string | null, now = Date.now()
): string[] {
    const previous = hostViews.get(clientId);
    const wasShown = previous && isFresh(previous, now) ? previous.noteId : null;

    if (noteId) {
        hostViews.set(clientId, { noteId, lastSeen: now });
    } else {
        hostViews.delete(clientId);
    }

    return wasShown === noteId ? [] : [ wasShown, noteId ].filter((id): id is string => !!id);
}

/** Drops the app views whose pings stopped. Returns the notes they showed. */
export function expireHostViews(now = Date.now()): string[] {
    const expired: string[] = [];

    for (const [ clientId, view ] of hostViews) {
        if (!isFresh(view, now)) {
            hostViews.delete(clientId);
            expired.push(view.noteId);
        }
    }

    return expired;
}

export function hasHostViews(): boolean {
    return hostViews.size > 0;
}

/** The host's app clients that show the note now. */
export function getHostViewers(noteId: string, now = Date.now()): string[] {
    return [ ...hostViews ]
        .filter(([ , view ]) => view.noteId === noteId && isFresh(view, now))
        .map(([ clientId ]) => clientId);
}

/** Keeps the removed guest out of the collaboration and frees their number. */
export function revokeCollabGuest(collabId: string, guestId: string) {
    revokedGuests.add(`${collabId}:${guestId}`);
    guestNumbers.get(collabId)?.delete(guestId);
}

export function isCollabGuestRevoked(
    collabId: string, guestId: string | null | undefined
): boolean {
    return !!guestId && revokedGuests.has(`${collabId}:${guestId}`);
}

/** Drops what is held about a collaboration that ended. */
export function forgetCollaboration(collabId: string) {
    guestNumbers.delete(collabId);
}

/** Whether the client can send another cursor message now, at most 20 in a second. */
export function allowCursorMessage(clientId: string, now = Date.now()): boolean {
    const window = cursorWindows.get(clientId);

    if (window && now - window.start < 1000) {
        window.count++;

        return window.count <= CURSOR_MESSAGES_PER_SECOND;
    }

    for (const [ id, stale ] of cursorWindows) {
        if (now - stale.start >= 60_000) {
            cursorWindows.delete(id);
        }
    }

    cursorWindows.set(clientId, { start: now, count: 1 });

    return true;
}

function buildHost(
    collab: BCollaboration, hostPages: readonly CollabClientInfo[], now: number
): CollabPerson | null {
    // The app's editor is open on the note it shows.
    const appView = getHostAppView(collab, now);

    if (!appView && hostPages.length === 0) {
        return null;
    }

    return {
        id: COLLAB_HOST_PERSON_ID,
        name: getHostDisplayName(collab),
        color: getHostColor(collab),
        isHost: true,
        ...(appView ? { noteId: appView.noteId, editing: true } : describePages(hostPages))
    };
}

/** The note in the collaboration's scope that one of the host's app clients showed last. */
function getHostAppView(collab: BCollaboration, now: number): HostView | null {
    let latest: HostView | null = null;

    for (const view of hostViews.values()) {
        const note = becca.getNote(view.noteId);

        if (isFresh(view, now) && note && isNoteInCollabScope(collab, note)
                && (!latest || view.lastSeen > latest.lastSeen)) {
            latest = view;
        }
    }

    return latest;
}

/** Where a person is: the note they edit in any of their pages, or else the one a page shows. */
function describePages(pages: readonly CollabClientInfo[]) {
    const editing = pages.find((page) => page.editingNoteId);
    const viewing = pages.find((page) => page.viewingNoteId);

    return {
        noteId: editing?.editingNoteId ?? viewing?.viewingNoteId ?? null,
        editing: !!editing
    };
}

/**
 * Numbers the guests present, giving a newcomer the lowest number nobody present holds, nor anyone
 * who left less than {@link NUMBER_KEPT_MS} ago.
 */
function trackGuestNumbers(collabId: string, present: readonly string[], now: number) {
    const numbers = guestNumbers.get(collabId) ?? new Map<string, GuestNumber>();
    const isPresent = new Set(present);

    for (const [ guestId, entry ] of numbers) {
        if (isPresent.has(guestId)) {
            entry.leftAt = null;
        } else if (entry.leftAt === null) {
            entry.leftAt = now;
        } else if (now - entry.leftAt >= NUMBER_KEPT_MS) {
            numbers.delete(guestId);
        }
    }

    for (const guestId of present) {
        if (!numbers.has(guestId)) {
            const taken = new Set([ ...numbers.values() ].map((entry) => entry.number));
            let number = 1;

            while (taken.has(number)) {
                number++;
            }

            numbers.set(guestId, { number, leftAt: null });
        }
    }

    if (numbers.size > 0) {
        guestNumbers.set(collabId, numbers);
    } else {
        guestNumbers.delete(collabId);
    }

    return new Map([ ...numbers ].map(([ guestId, entry ]) => [ guestId, entry.number ]));
}

function isFresh(view: HostView, now: number) {
    return now - view.lastSeen < HOST_VIEW_TTL_MS;
}
