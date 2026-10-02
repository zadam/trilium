import { normalizeCollabName } from "@triliumnext/commons";
import { type CollabConnection, ws } from "@triliumnext/core";
import { isCollabGuestRevoked } from "@triliumnext/core/src/collab/presence.js";
import collabService from "@triliumnext/core/src/collab/service.js";
import type { GuestCapability } from "@triliumnext/core/src/services/context.js";

/** The close code a guest socket gets when the collaboration has no room for it. */
export const COLLAB_FULL_CLOSE_CODE = 4503;
/** The close code of a guest's sockets after the host removed them. */
export const COLLAB_REMOVED_CLOSE_CODE = 4401;

/** What the upgrade decided: the connection, or that the page is told the collaboration is full. */
export type GuestSocketAdmission = CollabConnection | { refused: "full"; collabId: string };

interface GuestSession {
    loggedIn?: boolean;
    collab?: Record<string, { guestId: string; capabilities: GuestCapability[]; name?: string }>;
}

/**
 * Decides whether an upgrade request asks for a collaboration's guest socket (`?collab=<id>`) and
 * whether the session may have it: the same check the collaboration's page makes, on a grant the
 * page's join wrote and the host did not remove. Returns `false` for a request that is not a guest
 * socket at all, and a refusal when the collaboration is full, which the provider turns into a
 * close with {@link COLLAB_FULL_CLOSE_CODE} so the page can say so.
 */
export function admitGuestSocket(
    url: string | undefined, session: GuestSession | undefined
): GuestSocketAdmission | null | false {
    const collabParam = parseCollabParam(url);

    if (collabParam === null) {
        return false;
    }

    const collab = collabService.resolveCollaboration(collabParam);

    if (!collab) {
        return null;
    }

    const collabId = collab.collabId ?? "";
    const place = { viewingNoteId: null, editingNoteId: null };

    if (session?.loggedIn) {
        return { collabId, guestId: null, unlocked: [], name: null, isHost: true, ...place };
    }

    const grant = session?.collab?.[collabId];

    const capabilities = grant
        ? collabService.getEffectiveCapabilities(collab, grant.capabilities)
        : [];

    if (!grant || isCollabGuestRevoked(collabId, grant.guestId) || !capabilities.includes("view")) {
        return null;
    }

    if (ws.isCollabFull(collab, grant.guestId)) {
        return { refused: "full", collabId };
    }

    return {
        collabId,
        guestId: grant.guestId,
        unlocked: grant.capabilities,
        name: normalizeCollabName(grant.name),
        isHost: false,
        ...place
    };
}

function parseCollabParam(url: string | undefined): string | null {
    if (!url) {
        return null;
    }

    try {
        return new URL(url, "http://localhost").searchParams.get("collab");
    } catch {
        return null;
    }
}
