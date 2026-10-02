import { COLLAB_HOST_PERSON_ID, type Collaboration } from "@triliumnext/commons";
import { becca, NotFoundError, ValidationError, ws } from "@triliumnext/core";
import collabService, { type CollaborationSettings } from "@triliumnext/core/src/collab/service.js";
import type { Request } from "express";

import {
    applyPersonChanges, readPersonChanges, updateGuestGrant
} from "../../collab/guest_sessions.js";

type PersonRequest = Request<{ collabId: string; personId: string }>;

/**
 * The live collaborations: those opening `noteId` itself, or with `inScopeOf`, those whose pages
 * show that note.
 */
function getCollaborations(req: Request) {
    const noteId = typeof req.query.noteId === "string" ? req.query.noteId : null;
    const inScopeOf = typeof req.query.inScopeOf === "string" ? req.query.inScopeOf : null;
    const scopedNote = inScopeOf ? becca.getNote(inScopeOf) : null;

    if (inScopeOf) {
        return (scopedNote ? collabService.getCollaborationsForNote(scopedNote) : [])
            .map(collabService.toCollaborationDto) satisfies Collaboration[];
    }

    return becca.getCollaborations()
        .filter((collab) => !collab.isDeleted && (!noteId || collab.noteId === noteId))
        .sort((a, b) => (a.utcDateCreated < b.utcDateCreated ? -1 : 1))
        .map(collabService.toCollaborationDto) satisfies Collaboration[];
}

async function createCollaboration(req: Request) {
    const noteId = req.body?.noteId;

    if (typeof noteId !== "string" || !noteId) {
        throw new ValidationError("noteId is required.");
    }

    const collab = await collabService.createCollaboration(noteId, readSettings(req.body));

    return collabService.toCollaborationDto(collab) satisfies Collaboration;
}

async function updateCollaboration(req: Request<{ collabId: string }>) {
    const collab = getLiveCollaboration(req.params.collabId);

    const updated = await collabService.updateCollaboration(collab, readSettings(req.body));

    return collabService.toCollaborationDto(updated) satisfies Collaboration;
}

function getPresence(req: Request<{ collabId: string }>) {
    return ws.getCollabPresence(getLiveCollaboration(req.params.collabId).collabId ?? "");
}

/**
 * Renames or recolors someone in the list, for everyone: the host on the collaboration, a guest in
 * their grant. Each of the name and the color changes only when the body holds it.
 */
function updatePerson(req: PersonRequest) {
    const collab = getLiveCollaboration(req.params.collabId);
    const collabId = collab.collabId ?? "";
    const changes = readPersonChanges(req.body);

    if (req.params.personId === COLLAB_HOST_PERSON_ID) {
        if ("name" in changes) {
            collabService.setHostName(collab, changes.name);
        }

        if ("color" in changes) {
            collabService.setHostColor(collab, changes.color);
        }

        return;
    }

    const guestId = getConnectedGuestId(collabId, req.params.personId);

    updateGuestGrant(collabId, guestId, (grant) => applyPersonChanges(grant, changes));

    if ("name" in changes) {
        ws.renameCollabGuest(collabId, guestId, changes.name ?? null);
    }

    if ("color" in changes) {
        ws.recolorCollabGuest(collabId, guestId, changes.color ?? null);
    }
}

/**
 * Signs a guest out of the collaboration and disconnects their pages. Nothing blocks them: an open
 * link takes them back as a new guest, a password link asks for the password again.
 */
function removePerson(req: PersonRequest) {
    const collab = getLiveCollaboration(req.params.collabId);
    const collabId = collab.collabId ?? "";

    if (req.params.personId === COLLAB_HOST_PERSON_ID) {
        throw new ValidationError("The host cannot be removed.");
    }

    const guestId = getConnectedGuestId(collabId, req.params.personId);

    updateGuestGrant(collabId, guestId, () => null);
    ws.removeCollabGuest(collabId, guestId);
}

function deleteCollaboration(req: Request<{ collabId: string }>) {
    const collab = becca.getCollaboration(req.params.collabId);

    if (collab && !collab.isDeleted) {
        collabService.stopCollaboration(collab);
    }
}

export default {
    getCollaborations,
    createCollaboration,
    updateCollaboration,
    getPresence,
    updatePerson,
    removePerson,
    deleteCollaboration
};

function getLiveCollaboration(collabId: string) {
    const collab = becca.getCollaboration(collabId);

    if (!collab || collab.isDeleted) {
        throw new NotFoundError(`Collaboration '${collabId}' does not exist.`);
    }

    return collab;
}

/** The guest behind a person in the list; only a guest whose page is connected is listed. */
function getConnectedGuestId(collabId: string, personId: string) {
    const guestId = ws.findCollabGuestId(collabId, personId);

    if (!guestId) {
        throw new NotFoundError(`Nobody with the id '${personId}' is on the collaboration.`);
    }

    return guestId;
}

/** Picks the settings out of an untrusted body; the service validates the values. */
function readSettings(body: Record<string, unknown> | undefined): CollaborationSettings {
    return {
        includeSubtree: !!body?.includeSubtree,
        viewMode: body?.viewMode as CollaborationSettings["viewMode"],
        editMode: body?.editMode as CollaborationSettings["editMode"],
        createMode: body?.createMode as CollaborationSettings["createMode"],
        slug: optionalString(body?.slug),
        maxGuests: typeof body?.maxGuests === "number" ? body.maxGuests : undefined,
        hostName: optionalString(body?.hostName),
        viewPassword: optionalString(body?.viewPassword),
        editPassword: optionalString(body?.editPassword),
        createPassword: optionalString(body?.createPassword)
    };
}

function optionalString(value: unknown): string | null | undefined {
    if (value === undefined) {
        return undefined;
    }

    return typeof value === "string" ? value : null;
}
