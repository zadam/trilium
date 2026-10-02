import sql from "../services/sql.js";

/** A guest's grant on one collaboration, as their session stores it. */
export interface GuestGrant {
    guestId: string;
    capabilities: ("view" | "edit" | "create")[];
    since: string;
    name?: string;
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
