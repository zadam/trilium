import { becca, type BNote } from "@triliumnext/core";
import { isGuestEditableNote } from "@triliumnext/core/src/collab/guest_writes.js";
import { getShareEditPolicy, type ShareEditPolicy } from "@triliumnext/core/src/collab/share_edit.js";
import {
    isShareNoteReadable, isShareReady, shaca, shacaLoader
} from "@triliumnext/core/src/share/index.js";
import type { NextFunction, Request, Response } from "express";
import type SNote from "@triliumnext/core/src/share/shaca/entities/snote.js";

/** What the access middleware resolved for a request; handlers read it with {@link getShareEditState}. */
export interface ShareEditState {
    note: BNote;
    shared: SNote;
    policy: ShareEditPolicy;
}

export type ShareEditResolution =
    | { status: 403 | 404; message: string }
    | {
        note: BNote;
        shared: SNote;
        /** `null` where the note's subtree is not open to editing. */
        policy: ShareEditPolicy | null;
        /** Whether the session holds a grant on the subtree, or is the host's own. */
        unlocked: boolean;
    };

const NOTE_ID_PATTERN = /^[A-Za-z0-9_]{1,64}$/;

/**
 * Finds the shared note `noteId` as a guest of the page sees it: it must be one the request can
 * read on the share, and one guests can edit at all. The host's logged-in session is unlocked
 * everywhere, so the host can try the page as a guest would.
 */
export function resolveShareEdit(req: Request, noteId: unknown): ShareEditResolution {
    const notFound = { status: 404 as const, message: `Note '${String(noteId)}' not found.` };
    if (!isNoteIdParam(noteId) || !isShareReady()) {
        return notFound;
    }

    shacaLoader.ensureLoad();
    const shared = shaca.getNote(noteId);
    if (!shared || !isShareNoteReadable(noteId, { getHeader: (name) => req.header(name) })) {
        return notFound;
    }

    const note = becca.getNote(noteId);
    if (!note || !isGuestEditableNote(note)) {
        return { status: 403, message: "Guests cannot edit this note." };
    }

    const policy = getShareEditPolicy(shared);
    const unlocked = !!policy && (!!req.session.loggedIn || !!req.session.shareEdit?.[policy.rootNoteId]);
    return { note, shared, policy, unlocked };
}

/** Refuses the request unless the session may edit the note `:noteId` on its shared page. */
export function shareEditAccess(req: Request, res: Response, next: NextFunction) {
    const resolved = resolveShareEdit(req, req.params.noteId);
    if ("status" in resolved) {
        res.status(resolved.status).json({ message: resolved.message });
        return;
    }

    const { note, shared, policy, unlocked } = resolved;
    if (!policy) {
        res.status(403).json({ message: "Guests cannot edit this note." });
        return;
    }
    if (!unlocked) {
        res.status(401).json({ message: "Unlock editing first." });
        return;
    }

    res.locals.shareEdit = { note, shared, policy } satisfies ShareEditState;
    next();
}

export function getShareEditState(res: Response): ShareEditState {
    const state = res.locals.shareEdit as ShareEditState | undefined;
    if (!state) {
        throw new Error("shareEditAccess() did not run before this handler.");
    }

    return state;
}

/** Whether the value can be a note id. */
export function isNoteIdParam(value: unknown): value is string {
    return typeof value === "string" && NOTE_ID_PATTERN.test(value);
}
