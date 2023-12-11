"use strict";

const beccaService = require('../../becca/becca_service.js');
const revisionService = require('../../services/revisions.js');
const utils = require('../../services/utils.js');
const sql = require('../../services/sql.js');
const cls = require('../../services/cls.js');
const path = require('path');
const becca = require('../../becca/becca.js');
const blobService = require('../../services/blob.js');
const eraseService = require("../../services/erase.js");

function getRevisionBlob(req) {
    const preview = req.query.preview === 'true';

    return blobService.getBlobPojo('revisions', req.params.revisionId, { preview });
}

function getRevisions(req) {
    return becca.getRevisionsFromQuery(`
        SELECT revisions.*,
               LENGTH(blobs.content) AS contentLength
        FROM revisions
        JOIN blobs ON revisions.blobId = blobs.blobId 
        WHERE revisions.noteId = ?
        ORDER BY revisions.utcDateCreated DESC`, [req.params.noteId]);
}

function getRevision(req) {
    const revision = becca.getRevision(req.params.revisionId);

    if (revision.type === 'file') {
        if (revision.hasStringContent()) {
            revision.content = revision.getContent().substr(0, 10000);
        }
    }
    else {
        revision.content = revision.getContent();

        if (revision.content && revision.type === 'image') {
            revision.content = revision.content.toString('base64');
        }
    }

    return revision;
}

/**
 * @param {BRevision} revision
 * @returns {string}
 */
function getRevisionFilename(revision) {
    let filename = utils.formatDownloadTitle(revision.title, revision.type, revision.mime);

    const extension = path.extname(filename);
    const date = revision.dateCreated
        .substr(0, 19)
        .replace(' ', '_')
        .replace(/[^0-9_]/g, '');

    if (extension) {
        filename = `${filename.substr(0, filename.length - extension.length)}-${date}${extension}`;
    }
    else {
        filename += `-${date}`;
    }

    return filename;
}

function downloadRevision(req, res) {
    const revision = becca.getRevision(req.params.revisionId);

    if (!revision.isContentAvailable()) {
        return res.setHeader("Content-Type", "text/plain")
            .status(401)
            .send("Protected session not available");
    }

    const filename = getRevisionFilename(revision);

    res.setHeader('Content-Disposition', utils.getContentDisposition(filename));
    res.setHeader('Content-Type', revision.mime);

    res.send(revision.getContent());
}

function eraseAllRevisions(req) {
    const revisionIdsToErase = sql.getColumn('SELECT revisionId FROM revisions WHERE noteId = ?',
        [req.params.noteId]);

    eraseService.eraseRevisions(revisionIdsToErase);
}

function eraseRevision(req) {
    eraseService.eraseRevisions([req.params.revisionId]);
}

function restoreRevision(req) {
    const revision = becca.getRevision(req.params.revisionId);

    if (revision) {
        const note = revision.getNote();

        sql.transactional(() => {
            note.saveRevision();

            for (const oldNoteAttachment of note.getAttachments()) {
                oldNoteAttachment.markAsDeleted();
            }

            let revisionContent = revision.getContent();

            for (const revisionAttachment of revision.getAttachments()) {
                const noteAttachment = revisionAttachment.copy();
                noteAttachment.ownerId = note.noteId;
                noteAttachment.setContent(revisionAttachment.getContent(), { forceSave: true });

                // content is rewritten to point to the restored revision attachments
                revisionContent = revisionContent.replaceAll(`attachments/${revisionAttachment.attachmentId}`, `attachments/${noteAttachment.attachmentId}`);
            }

            note.title = revision.title;
            note.setContent(revisionContent, { forceSave: true });
        });
    }
}

function getEditedNotesOnDate(req) {
    const noteIds = sql.getColumn(`
        SELECT notes.*
        FROM notes
        WHERE noteId IN (
                SELECT noteId FROM notes 
                WHERE notes.dateCreated LIKE :date
                   OR notes.dateModified LIKE :date
            UNION ALL
                SELECT noteId FROM revisions
                WHERE revisions.dateLastEdited LIKE :date
        )
        ORDER BY isDeleted
        LIMIT 50`, {date: `${req.params.date}%`});

    let notes = becca.getNotes(noteIds, true);

    // Narrow down the results if a note is hoisted, similar to "Jump to note".
    const hoistedNoteId = cls.getHoistedNoteId();
    if (hoistedNoteId !== 'root') {
        notes = notes.filter(note => note.hasAncestor(hoistedNoteId));
    }

    return notes.map(note => {
        const notePath = getNotePathData(note);

        const notePojo = note.getPojo();
        notePojo.notePath = notePath ? notePath.notePath : null;

        return notePojo;
    });

}

function getNotePathData(note) {
    const retPath = note.getBestNotePath();

    if (retPath) {
        const noteTitle = beccaService.getNoteTitleForPath(retPath);

        let branchId;

        if (note.isRoot()) {
            branchId = 'none_root';
        }
        else {
            const parentNote = note.parents[0];
            branchId = becca.getBranchFromChildAndParent(note.noteId, parentNote.noteId).branchId;
        }

        return {
            noteId: note.noteId,
            branchId: branchId,
            title: noteTitle,
            notePath: retPath,
            path: retPath.join('/')
        };
    }
}

module.exports = {
    getRevisionBlob,
    getRevisions,
    getRevision,
    downloadRevision,
    getEditedNotesOnDate,
    eraseAllRevisions,
    eraseRevision,
    restoreRevision
};
