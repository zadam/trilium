import { type BCollaboration, becca, type BNote } from "@triliumnext/core";
import { isCollabGuestRevoked } from "@triliumnext/core/src/collab/presence.js";
import { renderCollab404, renderCollabLogin } from "@triliumnext/core/src/collab/renderer.js";
import collabService from "@triliumnext/core/src/collab/service.js";
import type { GuestCapability } from "@triliumnext/core/src/services/context.js";
import type { NextFunction, Request, Response } from "express";

/**
 * What the access middleware resolved for the request; the handlers read it through
 * {@link getCollabState}.
 */
export interface CollabRequestState {
    collab: BCollaboration;
    rootNote: BNote;
    capabilities: readonly GuestCapability[];
    /** The session's guest id here, or null before the guest unlocked anything. */
    guestId: string | null;
}

const ALL_CAPABILITIES: readonly GuestCapability[] = [ "view", "edit", "create" ];

const NOTE_ID_PATTERN = /^[A-Za-z0-9_]{1,64}$/;

/**
 * Resolves the collaboration behind `:collabId` and the capabilities this session holds on it,
 * then refuses the request unless it holds `required`. The host's own logged-in session holds
 * everything. A page a password could unlock answers with the password prompt; an API call
 * answers 401.
 */
export function collabAccess(required: GuestCapability | null) {
    return (req: Request, res: Response, next: NextFunction) => {
        const collabId = req.params.collabId;
        const collab = collabService.resolveCollaboration(
            typeof collabId === "string" ? collabId : "");
        const rootNote = collab?.getNote() ?? null;

        if (!collab || !rootNote || !collabService.isNoteInCollabScope(collab, rootNote)) {
            sendNotFound(req, res);
            return;
        }

        const grant = readGrant(req, collab.collabId ?? "");
        const capabilities = req.session.loggedIn
            ? ALL_CAPABILITIES
            : collabService.getEffectiveCapabilities(collab, grant?.capabilities ?? []);

        res.locals.collabState = {
            collab,
            rootNote,
            capabilities,
            guestId: grant?.guestId ?? null
        } satisfies CollabRequestState;

        if (required && !capabilities.includes(required)) {
            sendUnauthorized(req, res, collab, required);
            return;
        }

        next();
    };
}

/** The session's grant on the collaboration. A removed guest's grant leaves the session here. */
function readGrant(req: Request, collabId: string) {
    const grant = req.session.collab?.[collabId];

    if (grant && isCollabGuestRevoked(collabId, grant.guestId)) {
        const { [collabId]: _removed, ...remaining } = req.session.collab ?? {};
        req.session.collab = remaining;

        return undefined;
    }

    return grant;
}

export function getCollabState(res: Response): CollabRequestState {
    const state = res.locals.collabState as CollabRequestState | undefined;

    if (!state) {
        throw new Error("collabAccess() did not run before this handler.");
    }

    return state;
}

/** Returns the note when it is in the collaboration's scope, otherwise null. */
export function getScopedNote(state: CollabRequestState, noteId: string | undefined): BNote | null {
    const note = noteId ? becca.getNote(noteId) : null;

    return note && collabService.isNoteInCollabScope(state.collab, note) ? note : null;
}

/** Whether the value can be a note id, for the `returnTo` a form carries. */
export function isNoteIdParam(value: unknown): value is string {
    return typeof value === "string" && NOTE_ID_PATTERN.test(value);
}

export function sendNotFound(req: Request, res: Response) {
    if (wantsJson(req)) {
        res.status(404).json({ message: "Not found." });
        return;
    }

    res.status(404).type("html").send(renderCollab404());
}

function sendUnauthorized(
    req: Request, res: Response, collab: BCollaboration, required: GuestCapability
) {
    const canUnlock = collabService.getCapabilityMode(collab, required) === "password";

    if (wantsJson(req)) {
        res.status(canUnlock ? 401 : 403).json({
            message: `This request needs the '${required}' capability.`,
            capability: required
        });
        return;
    }

    if (!canUnlock) {
        res.status(403).type("html").send(renderCollab404());
        return;
    }

    const returnTo = isNoteIdParam(req.params.noteId) ? req.params.noteId : "";

    res.status(401).type("html").send(renderCollabLogin({ error: false, returnTo }));
}

function wantsJson(req: Request) {
    return req.path.includes("/api/") || req.is("application/json") === "application/json";
}
