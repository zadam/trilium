import { utils as coreUtils } from "@triliumnext/core";
import {
    MAX_GUEST_CONTENT_LENGTH, updateContentAsGuest, updateTitleAsGuest
} from "@triliumnext/core/src/collab/guest_writes.js";
import {
    buildEditPayload, SHARE_EDIT_PASSWORD_LABEL, verifyShareEditPassword
} from "@triliumnext/core/src/collab/share_edit.js";
import imageService from "@triliumnext/core/src/services/image.js";
import { isShareNoteReadable } from "@triliumnext/core/src/share/index.js";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import rateLimit from "express-rate-limit";
import { t } from "i18next";

import { doubleCsrfProtection as csrfMiddleware, generateCsrfToken } from "../routes/csrf_protection.js";
import { apiResultHandler, asyncRoute, createUploadMiddleware, route } from "../routes/route_api.js";
import { getShareEditState, resolveShareEdit, shareEditAccess } from "./auth.js";

/** The largest image or file a guest uploads into a note. */
export const MAX_GUEST_UPLOAD_BYTES = 20 * 1024 * 1024;

const GET = "get";
const PST = "post";
const PUT = "put";

/**
 * Mounts the routes a shared page edits its note through, beside the share's own: a text page
 * asks whether its note is open to editing, unlocks it, then saves through them with the app's
 * editor. They sit under `/share/api/`, so the page reaches them relative to itself, and never
 * set `session.loggedIn`, so `/api/*` stays closed to guests.
 */
function register(loginRateLimiter: RequestHandler) {
    asyncRoute(GET, "/share/api/edit/session", [], getSession, apiResultHandler);
    asyncRoute(PST, "/share/api/edit/login", [ loginRateLimiter ], login, apiResultHandler);
    asyncRoute(PST, "/share/api/edit/logout", [ csrfMiddleware ], logout, apiResultHandler);

    // An editor saves a few times a second while its guest types, for each guest behind the address.
    const typingRateLimiter = rateLimit({ windowMs: 60 * 1000, max: 1200 });
    const uploadRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
    const edit = [ typingRateLimiter, csrfMiddleware, shareEditAccess ];

    route(PUT, "/share/api/notes/:noteId/data", edit, updateContent, apiResultHandler);
    route(PUT, "/share/api/notes/:noteId/title", edit, updateTitle, apiResultHandler);
    asyncRoute(PST, "/share/api/notes/:noteId/attachments/upload",
        [ uploadRateLimiter, csrfMiddleware, shareEditAccess, requireAttachments, guestUploadMiddleware ],
        uploadAttachment, apiResultHandler);
}

export default {
    register
};

/**
 * Tells the page whether its note is open to editing and whether this session has unlocked it,
 * with the texts of its controls. It changes nothing: a page a crawler follows leaves no session
 * behind. An unlocked session gets a CSRF token, which it refreshes from here as the app does
 * from `/bootstrap`.
 */
function getSession(req: Request, res: Response) {
    const resolved = resolveShareEdit(req, req.query.noteId);
    if ("status" in resolved) {
        return resolved.status === 403 ? { editable: false } : [ 404, { message: resolved.message } ];
    }

    const { policy, unlocked } = resolved;
    if (!policy) {
        return { editable: false };
    }

    return {
        editable: true,
        needsPassword: policy.needsPassword,
        unlocked,
        rootNoteId: policy.rootNoteId,
        attachments: policy.attachments,
        csrfToken: unlocked ? issueCsrfToken(req, res) : undefined,
        strings: {
            edit: t("share_theme.edit"),
            unlock: t("share_theme.edit-unlock"),
            password: t("share_theme.edit-password"),
            stop: t("share_theme.edit-stop"),
            logOut: t("share_theme.edit-log-out"),
            wrongPassword: t("share_theme.edit-wrong-password"),
            failed: t("share_theme.edit-failed")
        }
    };
}

/**
 * Unlocks the note's subtree for this session, against its password where it has one, and
 * answers with what the page mounts the editor from: a CSRF token, the version of the note the
 * editor starts from, and the editor's payload. A wrong password answers 401, which the login
 * rate limiter counts.
 */
async function login(req: Request, res: Response) {
    const body = (req.body ?? {}) as { noteId?: unknown; password?: unknown };
    const resolved = resolveShareEdit(req, body.noteId);
    if ("status" in resolved) {
        return [ resolved.status, { message: resolved.message } ];
    }

    const { note, shared, policy, unlocked } = resolved;
    if (!policy) {
        return [ 403, { message: "Guests cannot edit this note." } ];
    }

    if (policy.needsPassword && !unlocked) {
        const stored = shared.getSecretLabelValue(SHARE_EDIT_PASSWORD_LABEL);
        if (typeof body.password !== "string" || !await verifyShareEditPassword(body.password, stored)) {
            return [ 401, { message: "Wrong password." } ];
        }
    }

    if (!unlocked) {
        // A session of its own, as the login page gives the host: the grant must not land in a
        // session fixed from outside.
        const grants = req.session.shareEdit ?? {};
        await regenerateSession(req);
        req.session.shareEdit = {
            ...grants,
            [policy.rootNoteId]: { guestId: coreUtils.randomSecureToken(16), since: new Date().toISOString() }
        };
    }

    const canAccess = (child: { noteId: string }) =>
        isShareNoteReadable(child.noteId, { getHeader: (name) => req.header(name) });
    return {
        csrfToken: issueCsrfToken(req, res),
        version: note.blobId ?? "",
        payload: buildEditPayload(shared, canAccess)
    };
}

/** Drops the session's grant on the subtree of the note `noteId`. */
function logout(req: Request) {
    const body = (req.body ?? {}) as { noteId?: unknown };
    const resolved = resolveShareEdit(req, body.noteId);
    if ("status" in resolved) {
        return [ resolved.status, { message: resolved.message } ];
    }

    const { policy } = resolved;
    if (policy && req.session.shareEdit) {
        const { [policy.rootNoteId]: _dropped, ...kept } = req.session.shareEdit;
        req.session.shareEdit = kept;
    }
}

function updateContent(req: Request<{ noteId: string }>, res: Response) {
    const { note } = getShareEditState(res);
    const body = (req.body ?? {}) as { content?: unknown; baseBlobId?: unknown };
    if (typeof body.content !== "string") {
        return [ 400, { message: "content must be a string." } ];
    }
    if (body.content.length > MAX_GUEST_CONTENT_LENGTH) {
        return [ 413, { message: "The content is too large for a guest save." } ];
    }

    const baseBlobId = typeof body.baseBlobId === "string" ? body.baseBlobId : null;
    const result = updateContentAsGuest(note, body.content, baseBlobId);
    if (!result.ok) {
        return [ 409, { message: "The note changed since it was loaded.", stale: result.current } ];
    }

    return { blobId: result.blobId };
}

function updateTitle(req: Request<{ noteId: string }>, res: Response) {
    const { note } = getShareEditState(res);
    const body = (req.body ?? {}) as { title?: unknown };
    if (typeof body.title !== "string") {
        return [ 400, { message: "title must be a string." } ];
    }

    return updateTitleAsGuest(note, body.title);
}

/** Refuses an upload into a subtree whose host did not allow attachments. */
function requireAttachments(req: Request, res: Response, next: NextFunction) {
    if (!getShareEditState(res).policy.attachments) {
        res.status(403).json({ message: "Guests cannot upload attachments here." });
        return;
    }

    next();
}

const guestUpload = createUploadMiddleware({ fileSize: MAX_GUEST_UPLOAD_BYTES, files: 1 });

function guestUploadMiddleware(req: Request, res: Response, next: NextFunction) {
    guestUpload(req, res, (err?: unknown) => {
        const code = (err as { code?: string } | undefined)?.code;
        if (code === "LIMIT_FILE_SIZE") {
            res.status(413).json({ message: "The file is too large for a guest upload." });
        } else if (err) {
            res.status(400).json({ message: "Upload rejected." });
        } else {
            next();
        }
    });
}

/**
 * Stores the uploaded image or file as an attachment of the note, as the app's upload route does,
 * and answers with the URL the editor puts into the note: one the share serves, which the app
 * resolves the same way from its own root.
 */
async function uploadAttachment(req: Request<{ noteId: string }>, res: Response) {
    const { note } = getShareEditState(res);
    const file = req.file;
    if (!file) {
        return [ 400, { message: "No file was uploaded." } ];
    }

    if (file.mimetype.startsWith("image/")) {
        const attachment = imageService.saveImageToAttachment(note.noteId, file.buffer, file.originalname, true, true);
        // The editor fetches the URL as soon as this answers, so the bytes are stored first.
        await imageService.awaitImageWrite(attachment.attachmentId);
        return {
            uploaded: true,
            url: `api/attachments/${attachment.attachmentId}/image/${encodeURIComponent(attachment.title)}`
        };
    }

    const attachment = note.saveAttachment({
        role: "file",
        mime: file.mimetype,
        title: file.originalname,
        content: file.buffer
    });
    return { uploaded: true, url: `api/attachments/${attachment.attachmentId}/download` };
}

function issueCsrfToken(req: Request, res: Response) {
    return generateCsrfToken(req, res, { overwrite: false, validateOnReuse: false });
}

function regenerateSession(req: Request) {
    return new Promise<void>((resolve, reject) => {
        req.session.regenerate((err: unknown) => (err ? reject(err) : resolve()));
    });
}
