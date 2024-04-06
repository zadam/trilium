"use strict";

import beccaService = require('../../becca/becca_service');
import revisionService = require('../../services/revisions');
import utils = require('../../services/utils');
import sql = require('../../services/sql');
import cls = require('../../services/cls');
import path = require('path');
import becca = require('../../becca/becca');
import blobService = require('../../services/blob');
import eraseService = require("../../services/erase");
import { Request, Response } from 'express';
import BRevision = require('../../becca/entities/brevision');
import BNote = require('../../becca/entities/bnote');
import { NotePojo } from '../../becca/becca-interface';

interface NotePath {
    noteId: string;
    branchId?: string;
    title: string;
    notePath: string[];
    path: string;
}

interface NotePojoWithNotePath extends NotePojo {
    notePath?: string[] | null;
}

function getRevisionBlob(req: Request) {
    const preview = req.query.preview === 'true';

    return blobService.getBlobPojo('revisions', req.params.revisionId, { preview });
}

function getRevisions(req: Request) {
    return becca.getRevisionsFromQuery(`
        SELECT revisions.*,
               LENGTH(blobs.content) AS contentLength
        FROM revisions
        JOIN blobs ON revisions.blobId = blobs.blobId 
        WHERE revisions.noteId = ?
        ORDER BY revisions.utcDateCreated DESC`, [req.params.noteId]);
}

function getRevision(req: Request) {
    const revision = becca.getRevisionOrThrow(req.params.revisionId);

    if (revision.type === 'file') {
        if (revision.hasStringContent()) {
            revision.content = (revision.getContent() as string).substr(0, 10000);
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

function getRevisionFilename(revision: BRevision) {
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

function downloadRevision(req: Request, res: Response) {
    const revision = becca.getRevisionOrThrow(req.params.revisionId);

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

function eraseAllRevisions(req: Request) {
    const revisionIdsToErase = sql.getColumn<string>('SELECT revisionId FROM revisions WHERE noteId = ?',
        [req.params.noteId]);

    eraseService.eraseRevisions(revisionIdsToErase);
}

function eraseRevision(req: Request) {
    eraseService.eraseRevisions([req.params.revisionId]);
}

function restoreRevision(req: Request) {
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
                if (typeof revisionContent === "string") {
                    revisionContent = revisionContent.replaceAll(`attachments/${revisionAttachment.attachmentId}`, `attachments/${noteAttachment.attachmentId}`);
                }
            }

            note.title = revision.title;
            note.setContent(revisionContent, { forceSave: true });
        });
    }
}

function getEditedNotesOnDate(req: Request) {
    const noteIds = sql.getColumn<string>(`
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

        const notePojo: NotePojoWithNotePath = note.getPojo();
        notePojo.notePath = notePath ? notePath.notePath : null;

        return notePojo;
    });

}

function getNotePathData(note: BNote): NotePath | undefined {
    const retPath = note.getBestNotePath();

    if (retPath) {
        const noteTitle = beccaService.getNoteTitleForPath(retPath);

        let branchId;

        if (note.isRoot()) {
            branchId = 'none_root';
        }
        else {
            const parentNote = note.parents[0];
            branchId = becca.getBranchFromChildAndParent(note.noteId, parentNote.noteId)?.branchId;
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

export = {
    getRevisionBlob,
    getRevisions,
    getRevision,
    downloadRevision,
    getEditedNotesOnDate,
    eraseAllRevisions,
    eraseRevision,
    restoreRevision
};
