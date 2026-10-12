import { becca, type BNote, getSql, ValidationError } from "@triliumnext/core";
import {
    hashShareEditPassword, MIN_SHARE_EDIT_PASSWORD_LENGTH, SHARE_ATTACHMENTS_LABEL,
    SHARE_EDIT_LABEL, SHARE_EDIT_PASSWORD_LABEL
} from "@triliumnext/core/src/collab/share_edit.js";
import type { Request } from "express";

const SHARE_EDIT_LABELS = [ SHARE_EDIT_LABEL, SHARE_EDIT_PASSWORD_LABEL, SHARE_ATTACHMENTS_LABEL ];

interface ShareEditBody {
    enabled?: unknown;
    /** A new password; `open` lets anyone with the link edit instead. */
    password?: unknown;
    open?: unknown;
    attachments?: unknown;
}

/**
 * Opens or closes the note's subtree to editing on its shared page, as the Shared badge's menu
 * asks: the three labels are written inheritable on the note. Opening needs a password or an
 * explicit `open`; a later call keeps the password it does not replace. The route is
 * asynchronous for the hash, so the writes open their own transaction, whose commit sends the
 * changes to the host's clients.
 */
async function setShareEdit(req: Request<{ noteId: string }>) {
    const note = becca.getNoteOrThrow(req.params.noteId);
    const body = (req.body ?? {}) as ShareEditBody;
    if (body.enabled !== true) {
        getSql().transactional(() => {
            for (const name of SHARE_EDIT_LABELS) {
                note.removeLabel(name);
            }
        });
        return { enabled: false };
    }

    let passwordHash: string | null = null;
    if (typeof body.password === "string") {
        if (body.password.length < MIN_SHARE_EDIT_PASSWORD_LENGTH) {
            throw new ValidationError(
                `The password needs ${MIN_SHARE_EDIT_PASSWORD_LENGTH} characters or more.`);
        }
        passwordHash = await hashShareEditPassword(body.password);
    } else if (body.open !== true && !note.hasOwnedLabel(SHARE_EDIT_LABEL)) {
        throw new ValidationError("Choose a password, or open editing to anyone with the link.");
    }

    getSql().transactional(() => {
        setInheritableLabel(note, SHARE_EDIT_LABEL, "");
        if (passwordHash !== null) {
            setInheritableLabel(note, SHARE_EDIT_PASSWORD_LABEL, passwordHash);
        } else if (body.open === true) {
            note.removeLabel(SHARE_EDIT_PASSWORD_LABEL);
        }
        if (body.attachments === true) {
            setInheritableLabel(note, SHARE_ATTACHMENTS_LABEL, "");
        } else if (body.attachments === false) {
            note.removeLabel(SHARE_ATTACHMENTS_LABEL);
        }
    });

    return {
        enabled: true,
        needsPassword: note.hasOwnedLabel(SHARE_EDIT_PASSWORD_LABEL),
        attachments: note.hasOwnedLabel(SHARE_ATTACHMENTS_LABEL)
    };
}

function setInheritableLabel(note: BNote, name: string, value: string) {
    const label = note.getOwnedLabel(name);
    if (!label) {
        note.addLabel(name, value, true);
    } else if (label.value !== value || !label.isInheritable) {
        label.value = value;
        label.isInheritable = true;
        label.save();
    }
}

export default {
    setShareEdit
};
