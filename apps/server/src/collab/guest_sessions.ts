import { normalizeCollabColor, normalizeCollabName } from "@triliumnext/commons";

import sql from "../services/sql.js";

/** A guest's grant on one collaboration, as their session stores it. */
export interface GuestGrant {
    guestId: string;
    capabilities: ("view" | "edit" | "create")[];
    since: string;
    name?: string;
    color?: string;
}

/** A change to how a person appears: a field left out stays, null goes back to the default. */
export interface PersonChanges {
    name?: string | null;
    color?: string | null;
}

/**
 * Picks the name and the color out of an untrusted body, each only when it is there: a blank name
 * and a color off the palette both mean the default.
 */
export function readPersonChanges(body: Record<string, unknown> | undefined): PersonChanges {
    return {
        ...(body && "name" in body ? { name: normalizeCollabName(body.name) } : {}),
        ...(body && "color" in body ? { color: normalizeCollabColor(body.color) } : {})
    };
}

/** The grant with the changes made; a default leaves the field out. */
export function applyPersonChanges(grant: GuestGrant, changes: PersonChanges): GuestGrant {
    const next = { ...grant };

    for (const field of [ "name", "color" ] as const) {
        if (field in changes) {
            next[field] = changes[field] ?? undefined;
        }
    }

    return next;
}

/**
 * Rewrites one guest's grant in the stored sessions, for the host's rename and remove: `update`
 * returns the new grant, or null to drop it. Only that collaboration's grant changes. The guest's
 * own in-flight request can still save the old grant back, which the revoked guests cover.
 * Returns how many sessions changed.
 */
export function updateGuestGrant(
    collabId: string, guestId: string, update: (grant: GuestGrant) => GuestGrant | null
): number {
    const rows = sql.getRows<{ id: string; data: string }>(
        /*sql*/`SELECT id, data FROM sessions WHERE instr(data, ?) > 0`, [ guestId ]);
    let changed = 0;

    for (const row of rows) {
        const session = parseSession(row.data);
        const grant = session?.collab?.[collabId];

        if (!session?.collab || grant?.guestId !== guestId) {
            continue;
        }

        const next = update(grant);

        if (next) {
            session.collab[collabId] = next;
        } else {
            delete session.collab[collabId];
        }

        sql.execute(/*sql*/`UPDATE sessions SET data = ? WHERE id = ?`,
            [ JSON.stringify(session), row.id ]);
        changed++;
    }

    return changed;
}

function parseSession(data: string): { collab?: Record<string, GuestGrant> } | null {
    try {
        const session = JSON.parse(data) as unknown;

        return typeof session === "object" && session !== null ? session : null;
    } catch {
        return null;
    }
}
