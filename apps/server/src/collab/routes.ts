import {
    COLLAB_HOST_PERSON_ID, isImageAttachmentRole, isSvgMime, normalizeCollabName,
    NOTE_TYPE_IMAGE_ATTACHMENTS
} from "@triliumnext/commons";
import {
    type BAttachment, becca, type BNote, cls, routes, utils as coreUtils, ws
} from "@triliumnext/core";
import {
    buildGuestTree, renderCollabFull, renderCollabLogin, renderCollabPage, renderCollabTreeMenu,
    serializeNoteForGuest
} from "@triliumnext/core/src/collab/renderer.js";
import guestWrites, {
    type GuestAppearance, MAX_GUEST_CONTENT_LENGTH
} from "@triliumnext/core/src/collab/guest_writes.js";
import { collabPersonId } from "@triliumnext/core/src/collab/presence.js";
import collabService from "@triliumnext/core/src/collab/service.js";
import type { GuestCapability } from "@triliumnext/core/src/services/context.js";
import { ensureShareHighlighting } from "@triliumnext/core/src/share/index.js";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import rateLimit from "express-rate-limit";

import {
    doubleCsrfProtection as csrfMiddleware, generateCsrfToken
} from "../routes/csrf_protection.js";
import { asyncRoute, route, router } from "../routes/route_api.js";
import { randomSecureToken } from "../services/utils.js";
import { registerShareProvider } from "../share/share_provider.js";
import {
    collabAccess, type CollabRequestState, getCollabState, getScopedNote, isNoteIdParam,
    sendNotFound
} from "./auth.js";

type CollabRequest = Request<{ collabId: string; noteId?: string; attachmentId?: string }>;

const API = "/collab/:collabId/api";

/**
 * Mounts the guest-facing routes. The API sits under `/collab/:collabId/api/` so that the
 * relative links the renderer emits (`api/images/...`, `./<noteId>`) resolve from both page
 * depths. Guests never set `session.loggedIn`, so `/api/*` stays closed to them.
 */
function register(loginRateLimiter: RequestHandler) {
    registerShareProvider();

    // Relative links on the page only resolve below `/collab/<id>/`, never at `/collab/<id>`.
    router.get("/collab/:collabId", (req, res, next) => {
        if (req.path.endsWith("/")) {
            next();
            return;
        }

        res.redirect(`${encodeURIComponent(req.params.collabId)}/`);
    });

    const view = [ collabAccess("view") ];

    asyncRoute("get", "/collab/:collabId", view, renderPage, null);
    asyncRoute("get", "/collab/:collabId/:noteId", view, renderPage, null);
    asyncRoute("post", "/collab/:collabId/login",
        [ loginRateLimiter, collabAccess(null) ], login, null);
    route("post", "/collab/:collabId/logout", [ csrfMiddleware, collabAccess(null) ], logout, null);

    // Each page joins once, so a scripted flood of joins gets nowhere fast.
    const joinRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
    route("post", `${API}/join`, [ joinRateLimiter, collabAccess("view") ], join,
        guestResultHandler);

    route("get", `${API}/tree`, view, getTree, guestResultHandler);
    route("get", `${API}/notes/:noteId`, view, getNote, guestResultHandler);
    route("get", `${API}/notes/:noteId/download`, view, downloadNote, null);
    route("get", `${API}/notes/:noteId/view`, view, viewNote, null);
    route("get", `${API}/notes/:noteId/image-attachments`, view, getImageAttachments,
        guestResultHandler);
    route("get", `${API}/images/:noteId/:filename`, view, getImage, null);
    route("get", `${API}/attachments/:attachmentId/image/:filename`, view,
        getAttachmentImage, null);
    route("get", `${API}/attachments/:attachmentId/download`, view, downloadAttachment, null);

    // Caps how fast one address can write through any collaboration.
    const writeRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
    const edit = [ collabAccess("edit"), rejectWhenFull, csrfMiddleware, writeRateLimiter ];
    const create = [ collabAccess("create"), rejectWhenFull, csrfMiddleware, writeRateLimiter ];

    route("put", `${API}/notes/:noteId/content`, edit, updateContent, guestResultHandler);
    route("put", `${API}/notes/:noteId/title`, edit, updateTitle, guestResultHandler);
    route("put", `${API}/notes/:noteId/appearance`, edit, updateAppearance, guestResultHandler);
    route("put", `${API}/notes/:noteId/type`, edit, changeType, guestResultHandler);
    route("put", `${API}/me`, [ collabAccess("view"), csrfMiddleware, writeRateLimiter ],
        renameSelf, guestResultHandler);
    route("get", `${API}/icons`, view, getIcons, guestResultHandler);
    route("get", `${API}/tree-menu`, view, getTreeMenu, guestResultHandler);
    route("post", `${API}/notes/:noteId/children`, create, createChild, guestResultHandler);
}

export default {
    register
};

async function renderPage(req: CollabRequest, res: Response) {
    const state = enterGuestContext(req, res);
    const note = req.params.noteId ? getScopedNote(state, req.params.noteId) : state.rootNote;

    if (!note) {
        sendNotFound(req, res);
        return;
    }

    if (!req.session.loggedIn && ws.isCollabFull(state.collab, state.guestId)) {
        res.setHeader("Retry-After", "30");
        res.status(503).type("html").send(renderCollabFull(state.collab));
        return;
    }

    await ensureShareHighlighting();

    const collabId = state.collab.collabId ?? "";

    // A guest who can write needs a CSRF token, and a token needs a persisted session.
    if (!state.guestId && !req.session.loggedIn && state.capabilities.includes("edit")) {
        state.guestId = grantAnonymousSession(req, collabId);
    }

    const csrfToken = state.guestId || req.session.loggedIn
        ? generateCsrfToken(req, res, { overwrite: false, validateOnReuse: false })
        : null;
    const grant = req.session.collab?.[collabId];

    res.setHeader("X-Robots-Tag", "noindex");
    res.status(200).type("html").send(renderCollabPage(state.collab, note, {
        capabilities: state.capabilities,
        csrfToken,
        selfId: getSelfId(req, collabId, state.guestId),
        canLogout: !!grant && grant.capabilities.length > 0
    }));
}

/**
 * Gives a page without a session a guest of its own, before it connects: a viewer's page renders
 * without one, so that a crawler following the link leaves no session behind. JSON only, so a
 * form on another site cannot join on the visitor's behalf.
 */
function join(req: CollabRequest, res: Response) {
    if (!req.is("application/json")) {
        return [ 415, { message: "Expected a JSON body." } ];
    }

    const state = getCollabState(res);
    const collabId = state.collab.collabId ?? "";

    if (!state.guestId && !req.session.loggedIn) {
        state.guestId = grantAnonymousSession(req, collabId);
    }

    // The token binds to the session the grant persists.
    return {
        selfId: getSelfId(req, collabId, state.guestId),
        csrfToken: generateCsrfToken(req, res, { overwrite: false, validateOnReuse: false })
    };
}

/**
 * Renames the page's own person: a guest in their grant, the host on the collaboration. A blank
 * name goes back to the default one.
 */
function renameSelf(req: CollabRequest, res: Response) {
    const state = enterGuestContext(req, res);
    const collabId = state.collab.collabId ?? "";
    const name = normalizeCollabName(req.body?.name);

    if (req.session.loggedIn) {
        collabService.setHostName(state.collab, name);

        return { name };
    }

    const grant = req.session.collab?.[collabId];

    if (!grant) {
        return [ 409, { message: "Join the collaboration first." } ];
    }

    req.session.collab = {
        ...req.session.collab,
        [collabId]: { ...grant, name: name ?? undefined }
    };
    ws.renameCollabGuest(collabId, grant.guestId, name);

    return { name };
}

/** The person a page is in the list: the host, the session's guest, or nobody yet. */
function getSelfId(req: CollabRequest, collabId: string, guestId: string | null) {
    if (req.session.loggedIn) {
        return COLLAB_HOST_PERSON_ID;
    }

    return guestId ? collabPersonId(collabId, guestId) : null;
}

function updateContent(req: CollabRequest, res: Response) {
    const state = enterGuestContext(req, res);
    const note = getScopedNote(state, req.params.noteId);

    if (!note) {
        return [ 404, { message: "Not found." } ];
    }

    const content = req.body?.content;

    if (typeof content !== "string") {
        return [ 400, { message: "content must be a string." } ];
    }

    if (content.length > MAX_GUEST_CONTENT_LENGTH) {
        return [ 413, { message: "The content is too large for a guest save." } ];
    }

    const preview: unknown = req.body?.preview;

    if (preview !== undefined && preview !== null && typeof preview !== "string") {
        return [ 400, { message: "preview must be a string." } ];
    }

    const baseBlobId = typeof req.body?.baseBlobId === "string" ? req.body.baseBlobId : null;
    const result = guestWrites.updateContentAsGuest(note, content, baseBlobId, preview);

    if (!result.ok) {
        return [ 409, { message: "The note changed since it was loaded.", ...result.current } ];
    }

    return { blobId: result.blobId, utcDateModified: result.utcDateModified };
}

function updateTitle(req: CollabRequest, res: Response) {
    const state = enterGuestContext(req, res);
    const note = getScopedNote(state, req.params.noteId);

    if (!note) {
        return [ 404, { message: "Not found." } ];
    }

    const title = req.body?.title;

    if (typeof title !== "string") {
        return [ 400, { message: "title must be a string." } ];
    }

    return guestWrites.updateTitleAsGuest(note, title);
}

function changeType(req: CollabRequest, res: Response) {
    const state = enterGuestContext(req, res);
    const note = getScopedNote(state, req.params.noteId);

    if (!note) {
        return [ 404, { message: "Not found." } ];
    }

    return guestWrites.changeTypeAsGuest(note, req.body?.type, req.body?.mime);
}

function updateAppearance(req: CollabRequest, res: Response) {
    const state = enterGuestContext(req, res);
    const note = getScopedNote(state, req.params.noteId);

    if (!note) {
        return [ 404, { message: "Not found." } ];
    }

    const body = req.body ?? {};
    const appearance: GuestAppearance = {};

    for (const field of [ "color", "iconClass" ] as const) {
        if (field in body) {
            if (body[field] !== null && typeof body[field] !== "string") {
                return [ 400, { message: `${field} must be a string or null.` } ];
            }

            appearance[field] = body[field];
        }
    }

    return guestWrites.updateAppearanceAsGuest(note, appearance);
}

/** The rendered tree with `active` marked, and that note's icon and color, for a live refresh. */
function getTreeMenu(req: CollabRequest, res: Response) {
    const state = enterGuestContext(req, res);
    const active = typeof req.query.active === "string" && req.query.active
        ? getScopedNote(state, req.query.active)
        : state.rootNote;

    if (!active) {
        return [ 404, { message: "Not found." } ];
    }

    return renderCollabTreeMenu(state.collab, active, state.capabilities);
}

/** The built-in icon packs, for the page's icon chooser; the host's own packs stay private. */
function getIcons() {
    return guestWrites.getGuestIconRegistry();
}

function createChild(req: CollabRequest, res: Response) {
    const state = enterGuestContext(req, res);
    const parent = getScopedNote(state, req.params.noteId);

    if (!parent) {
        return [ 404, { message: "Not found." } ];
    }

    const title: unknown = req.body?.title;

    if (title !== undefined && typeof title !== "string") {
        return [ 400, { message: "title must be a string." } ];
    }

    return guestWrites.createChildAsGuest(state.collab, parent, title);
}

async function login(req: CollabRequest, res: Response) {
    const state = getCollabState(res);
    const collabId = state.collab.collabId ?? "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const returnTo = isNoteIdParam(req.body?.returnTo) ? req.body.returnTo : "";
    const unlocked = password ? await collabService.unlockCapabilities(state.collab, password) : [];

    // 401 keeps the login rate limiter counting the attempt.
    if (unlocked.length === 0) {
        if (req.is("application/json")) {
            res.status(401).json({ message: "The password did not match." });
        } else {
            res.status(401).type("html").send(renderCollabLogin({ error: true, returnTo }));
        }

        return;
    }

    const grants = req.session.collab ?? {};
    const existing = grants[collabId];
    const grant = {
        ...existing,
        guestId: existing?.guestId ?? randomSecureToken(16),
        capabilities: mergeCapabilities(existing?.capabilities ?? [], unlocked),
        since: existing?.since ?? new Date().toISOString()
    };

    // A fresh session id defeats fixation; the host's own session is left as it is.
    if (!req.session.loggedIn) {
        await new Promise<void>((resolve) => req.session.regenerate(() => resolve()));
    }

    req.session.collab = { ...grants, [collabId]: grant };

    if (req.is("application/json")) {
        res.status(200).json({
            capabilities: collabService.getEffectiveCapabilities(state.collab, grant.capabilities)
        });
    } else {
        res.redirect(returnTo ? `./${returnTo}` : "./");
    }
}

function logout(req: CollabRequest, res: Response) {
    const collabId = getCollabState(res).collab.collabId ?? "";

    if (req.session.collab) {
        const { [collabId]: _dropped, ...remaining } = req.session.collab;
        req.session.collab = remaining;
    }

    res.redirect("./");
}

function getTree(req: CollabRequest, res: Response) {
    const state = enterGuestContext(req, res);

    return {
        rootNoteId: state.rootNote.noteId,
        tree: state.collab.includeSubtree ? buildGuestTree(state.collab, state.rootNote) : null
    };
}

function getNote(req: CollabRequest, res: Response) {
    const state = enterGuestContext(req, res);
    const note = getScopedNote(state, req.params.noteId);

    if (!note) {
        return [ 404, { message: "Not found." } ];
    }

    return serializeNoteForGuest(note);
}

/**
 * The pictures a canvas draws from: the note's image attachments other than the previews, which
 * a note keeps from each type it was.
 */
function getImageAttachments(req: CollabRequest, res: Response) {
    const state = enterGuestContext(req, res);
    const note = getScopedNote(state, req.params.noteId);

    if (!note) {
        return [ 404, { message: "Not found." } ];
    }

    const previewTitles = new Set<string>(Object.values(NOTE_TYPE_IMAGE_ATTACHMENTS));

    return note.getAttachments()
        .filter((attachment) => isImageAttachmentRole(attachment.role)
            && !previewTitles.has(attachment.title))
        .map(({ attachmentId, title }) => ({ attachmentId, title }));
}

function downloadNote(req: CollabRequest, res: Response) {
    const note = requireScopedNote(req, res);

    if (!note) {
        return;
    }

    const filename = coreUtils.formatDownloadTitle(note.title, note.type, note.mime);
    res.setHeader("Content-Disposition", coreUtils.getContentDisposition(filename));
    sendBytes(res, note.mime, note.getContent());
}

/** Used for PDF viewing. */
function viewNote(req: CollabRequest, res: Response) {
    const note = requireScopedNote(req, res);

    if (!note) {
        return;
    }

    sendBytes(res, note.mime, note.getContent());
}

function getImage(req: CollabRequest, res: Response) {
    const note = requireScopedNote(req, res);

    if (!note) {
        return;
    }

    switch (note.type) {
        case "image":
            sendImageBytes(res, note.mime, note.getContent());
            return;
        case "canvas":
        case "mermaid":
        case "mindMap":
            sendSvg(res, coreUtils.sanitizeSvg(
                readRenderedSvg(note, NOTE_TYPE_IMAGE_ATTACHMENTS[note.type])));
            return;
        default:
            res.status(400).json({ message: "Requested note is not an image." });
    }
}

function getAttachmentImage(req: CollabRequest, res: Response) {
    const attachment = requireScopedAttachment(req, res);

    if (!attachment) {
        return;
    }

    if (!isImageAttachmentRole(attachment.role)) {
        res.status(400).json({ message: "Requested attachment is not an image." });
        return;
    }

    sendImageBytes(res, attachment.mime, attachment.getContent());
}

function downloadAttachment(req: CollabRequest, res: Response) {
    const attachment = requireScopedAttachment(req, res);

    if (!attachment) {
        return;
    }

    const filename = coreUtils.formatDownloadTitle(attachment.title, null, attachment.mime);
    res.setHeader("Content-Disposition", coreUtils.getContentDisposition(filename));
    sendBytes(res, attachment.mime, attachment.getContent());
}

/** Marks the request as the guest's in the request context, so services can tell it apart. */
function enterGuestContext(req: CollabRequest, res: Response): CollabRequestState {
    const state = getCollabState(res);

    if (!req.session.loggedIn) {
        cls.setPrincipal({
            kind: "guest",
            collabId: state.collab.collabId ?? "",
            guestId: state.guestId ?? "anonymous",
            capabilities: state.capabilities
        });
    }

    return state;
}

function requireScopedNote(req: CollabRequest, res: Response): BNote | null {
    const note = getScopedNote(enterGuestContext(req, res), req.params.noteId);

    if (!note) {
        sendNotFound(req, res);
    }

    return note;
}

/** An attachment is in scope when the note that owns it is. */
function requireScopedAttachment(req: CollabRequest, res: Response): BAttachment | null {
    const state = enterGuestContext(req, res);
    const attachmentId = req.params.attachmentId;
    const attachment = attachmentId ? becca.getAttachment(attachmentId) : null;
    const owner = attachment ? getScopedNote(state, attachment.ownerId) : null;

    if (!attachment || !owner) {
        sendNotFound(req, res);
        return null;
    }

    return attachment;
}

/** Keeps a guest without a seat from writing: the limit counts sockets, a save needs none. */
function rejectWhenFull(req: Request, res: Response, next: NextFunction) {
    const state = getCollabState(res);

    if (!req.session.loggedIn && ws.isCollabFull(state.collab, state.guestId)) {
        res.setHeader("Retry-After", "30");
        res.status(503).json({ message: "The collaboration is full right now.", full: true });
        return;
    }

    next();
}

/** Persists a session for a guest who never entered a password, so a CSRF token can bind to it. */
function grantAnonymousSession(req: CollabRequest, collabId: string): string {
    const guestId = randomSecureToken(16);

    req.session.collab = {
        ...(req.session.collab ?? {}),
        [collabId]: { guestId, capabilities: [], since: new Date().toISOString() }
    };

    return guestId;
}

function mergeCapabilities(
    held: readonly GuestCapability[], unlocked: readonly GuestCapability[]
): GuestCapability[] {
    return ([ "view", "edit", "create" ] as const)
        .filter((capability) => held.includes(capability) || unlocked.includes(capability));
}

function readRenderedSvg(note: BNote, attachmentTitle: string): string {
    const content = note.getAttachmentByTitle(attachmentTitle)?.getContent();

    if (content && content.length > 0) {
        return typeof content === "string" ? content : new TextDecoder().decode(content);
    }

    // Before attachments existed, the SVG lived in the note's JSON content under `svg`.
    const json = note.getJsonContentSafely();

    const svg = typeof json === "object" && json !== null && "svg" in json ? json.svg : null;

    return typeof svg === "string" ? svg : "<svg/>";
}

function sendImageBytes(res: Response, mime: string, content: string | Uint8Array | undefined) {
    if (isSvgMime(mime)) {
        const svg = typeof content === "string"
            ? content
            : new TextDecoder().decode(content ?? new Uint8Array());
        sendSvg(res, coreUtils.sanitizeSvg(svg));
        return;
    }

    sendBytes(res, mime, content);
}

function sendSvg(res: Response, svg: string) {
    res.setHeader("Content-Security-Policy", coreUtils.SVG_CONTENT_SECURITY_POLICY);
    res.setHeader("X-Content-Type-Options", "nosniff");
    sendBytes(res, "image/svg+xml", svg);
}

function sendBytes(res: Response, mime: string, content: string | Uint8Array | undefined) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("X-Robots-Tag", "noindex");
    res.setHeader("Content-Type", mime);
    res.status(200).send(content instanceof Uint8Array ? Buffer.from(content) : content ?? "");
}

/** The internal API's result handler without the entity-change counter header (host-only). */
function guestResultHandler(req: Request, res: Response, result: unknown): number {
    result = routes.convertEntitiesToPojo(result);

    let statusCode = 200;
    let payload = result;

    if (Array.isArray(result) && result.length > 0 && Number.isInteger(result[0])) {
        [ statusCode, payload ] = result as [number, unknown];
    } else if (result === undefined) {
        res.status(204).send("");
        return 0;
    }

    const json = JSON.stringify(payload);

    res.setHeader("Content-Type", "application/json");
    res.status(statusCode).send(json);

    return json.length;
}
