const sql = require('./sql.js');
const optionService = require('./options.js');
const dateUtils = require('./date_utils.js');
const entityChangesService = require('./entity_changes.js');
const eventService = require('./events.js');
const cls = require('../services/cls.js');
const protectedSessionService = require('../services/protected_session.js');
const log = require('../services/log.js');
const utils = require('../services/utils.js');
const revisionService = require('./revisions.js');
const request = require('./request.js');
const path = require('path');
const url = require('url');
const becca = require('../becca/becca.js');
const BBranch = require('../becca/entities/bbranch.js');
const BNote = require('../becca/entities/bnote.js');
const BAttribute = require('../becca/entities/battribute.js');
const BAttachment = require('../becca/entities/battachment.js');
const dayjs = require("dayjs");
const htmlSanitizer = require('./html_sanitizer.js');
const ValidationError = require('../errors/validation_error.js');
const noteTypesService = require('./note_types.js');
const fs = require("fs");
const ws = require('./ws.js');
const html2plaintext = require('html2plaintext')

/** @param {BNote} parentNote */
function getNewNotePosition(parentNote) {
    if (parentNote.isLabelTruthy('newNotesOnTop')) {
        const minNotePos = parentNote.getChildBranches()
            .filter(branch => branch.noteId !== '_hidden') // has "always last" note position
            .reduce((min, note) => Math.min(min, note.notePosition), 0);

        return minNotePos - 10;
    } else {
        const maxNotePos = parentNote.getChildBranches()
            .filter(branch => branch.noteId !== '_hidden') // has "always last" note position
            .reduce((max, note) => Math.max(max, note.notePosition), 0);

        return maxNotePos + 10;
    }
}

/** @param {BNote} note */
function triggerNoteTitleChanged(note) {
    eventService.emit(eventService.NOTE_TITLE_CHANGED, note);
}

function deriveMime(type, mime) {
    if (!type) {
        throw new Error(`Note type is a required param`);
    }

    if (mime) {
        return mime;
    }

    return noteTypesService.getDefaultMimeForNoteType(type);
}

/**
 * @param {BNote} parentNote
 * @param {BNote} childNote
 */
function copyChildAttributes(parentNote, childNote) {
    for (const attr of parentNote.getAttributes()) {
        if (attr.name.startsWith("child:")) {
            const name = attr.name.substr(6);
            const hasAlreadyTemplate = childNote.hasRelation('template');

            if (hasAlreadyTemplate && attr.type === 'relation' && name === 'template') {
                // if the note already has a template, it means the template was chosen by the user explicitly
                // in the menu. In that case, we should override the default templates defined in the child: attrs
                continue;
            }

            new BAttribute({
                noteId: childNote.noteId,
                type: attr.type,
                name: name,
                value: attr.value,
                position: attr.position,
                isInheritable: attr.isInheritable
            }).save();
        }
    }
}

/** @param {BNote} parentNote */
function getNewNoteTitle(parentNote) {
    let title = "new note";

    const titleTemplate = parentNote.getLabelValue('titleTemplate');

    if (titleTemplate !== null) {
        try {
            const now = dayjs(cls.getLocalNowDateTime() || new Date());

            // "officially" injected values:
            // - now
            // - parentNote

            title = eval(`\`${titleTemplate}\``);
        } catch (e) {
            log.error(`Title template of note '${parentNote.noteId}' failed with: ${e.message}`);
        }
    }

    // this isn't in theory a good place to sanitize title, but this will catch a lot of XSS attempts.
    // title is supposed to contain text only (not HTML) and be printed text only, but given the number of usages,
    // it's difficult to guarantee correct handling in all cases
    title = htmlSanitizer.sanitize(title);

    return title;
}

function getAndValidateParent(params) {
    const parentNote = becca.notes[params.parentNoteId];

    if (!parentNote) {
        throw new ValidationError(`Parent note '${params.parentNoteId}' was not found.`);
    }

    if (parentNote.type === 'launcher' && parentNote.noteId !== '_lbBookmarks') {
        throw new ValidationError(`Creating child notes into launcher notes is not allowed.`);
    }

    if (['_lbAvailableLaunchers', '_lbVisibleLaunchers'].includes(params.parentNoteId) && params.type !== 'launcher') {
        throw new ValidationError(`Only 'launcher' notes can be created in parent '${params.parentNoteId}'`);
    }

    if (!params.ignoreForbiddenParents) {
        if (['_lbRoot', '_hidden'].includes(parentNote.noteId)
            || parentNote.noteId.startsWith("_lbTpl")
            || parentNote.isOptions()) {

            throw new ValidationError(`Creating child notes into '${parentNote.noteId}' is not allowed.`);
        }
    }

    return parentNote;
}

/**
 * Following object properties are mandatory:
 * - {string} parentNoteId
 * - {string} title
 * - {*} content
 * - {string} type - text, code, file, image, search, book, relationMap, canvas, render
 *
 * The following are optional (have defaults)
 * - {string} mime - value is derived from default mimes for type
 * - {boolean} isProtected - default is false
 * - {boolean} isExpanded - default is false
 * - {string} prefix - default is empty string
 * - {int} notePosition - default is the last existing notePosition in a parent + 10
 *
 * @param params
 * @returns {{note: BNote, branch: BBranch}}
 */
function createNewNote(params) {
    const parentNote = getAndValidateParent(params);

    if (params.title === null || params.title === undefined) {
        params.title = getNewNoteTitle(parentNote);
    }

    if (params.content === null || params.content === undefined) {
        throw new Error(`Note content must be set`);
    }

    let error;
    if (error = dateUtils.validateLocalDateTime(params.dateCreated)) {
        throw new Error(error);
    }

    if (error = dateUtils.validateUtcDateTime(params.utcDateCreated)) {
        throw new Error(error);
    }

    return sql.transactional(() => {
        let note, branch, isEntityEventsDisabled;

        try {
            isEntityEventsDisabled = cls.isEntityEventsDisabled();

            if (!isEntityEventsDisabled) {
                // it doesn't make sense to run note creation events on a partially constructed note, so
                // defer them until note creation is completed
                cls.disableEntityEvents();
            }

            // TODO: think about what can happen if the note already exists with the forced ID
            //       I guess on DB it's going to be fine, but becca references between entities
            //       might get messed up (two note instances for the same ID existing in the references)
            note = new BNote({
                noteId: params.noteId, // optionally can force specific noteId
                title: params.title,
                isProtected: !!params.isProtected,
                type: params.type,
                mime: deriveMime(params.type, params.mime),
                dateCreated: params.dateCreated,
                utcDateCreated: params.utcDateCreated
            }).save();

            note.setContent(params.content);

            branch = new BBranch({
                noteId: note.noteId,
                parentNoteId: params.parentNoteId,
                notePosition: params.notePosition !== undefined ? params.notePosition : getNewNotePosition(parentNote),
                prefix: params.prefix,
                isExpanded: !!params.isExpanded
            }).save();
        }
        finally {
            if (!isEntityEventsDisabled) {
                // re-enable entity events only if they were previously enabled
                // (they can be disabled in case of import)
                cls.enableEntityEvents();
            }
        }

        asyncPostProcessContent(note, params.content);

        if (params.templateNoteId) {
            if (!becca.getNote(params.templateNoteId)) {
                throw new Error(`Template note '${params.templateNoteId}' does not exist.`);
            }

            note.addRelation('template', params.templateNoteId);

            // no special handling for ~inherit since it doesn't matter if it's assigned with the note creation or later
        }

        copyChildAttributes(parentNote, note);

        eventService.emit(eventService.ENTITY_CREATED, { entityName: 'notes', entity: note });
        eventService.emit(eventService.ENTITY_CHANGED, { entityName: 'notes', entity: note });
        triggerNoteTitleChanged(note);
        // blobs entity doesn't use "created" event
        eventService.emit(eventService.ENTITY_CHANGED, { entityName: 'blobs', entity: note });
        eventService.emit(eventService.ENTITY_CREATED, { entityName: 'branches', entity: branch });
        eventService.emit(eventService.ENTITY_CHANGED, { entityName: 'branches', entity: branch });
        eventService.emit(eventService.CHILD_NOTE_CREATED, { childNote: note, parentNote: parentNote });

        log.info(`Created new note '${note.noteId}', branch '${branch.branchId}' of type '${note.type}', mime '${note.mime}'`);

        return {
            note,
            branch
        };
    });
}

function createNewNoteWithTarget(target, targetBranchId, params) {
    if (!params.type) {
        const parentNote = becca.notes[params.parentNoteId];

        // code note type can be inherited, otherwise "text" is the default
        params.type = parentNote.type === 'code' ? 'code' : 'text';
        params.mime = parentNote.type === 'code' ? parentNote.mime : 'text/html';
    }

    if (target === 'into') {
        return createNewNote(params);
    }
    else if (target === 'after') {
        const afterBranch = becca.branches[targetBranchId];

        // not updating utcDateModified to avoid having to sync whole rows
        sql.execute('UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0',
            [params.parentNoteId, afterBranch.notePosition]);

        params.notePosition = afterBranch.notePosition + 10;

        const retObject = createNewNote(params);

        entityChangesService.putNoteReorderingEntityChange(params.parentNoteId);

        return retObject;
    }
    else {
        throw new Error(`Unknown target '${target}'`);
    }
}

/**
 * @param {BNote} note
 * @param {boolean} protect
 * @param {boolean} includingSubTree
 * @param {TaskContext} taskContext
 */
function protectNoteRecursively(note, protect, includingSubTree, taskContext) {
    protectNote(note, protect);

    taskContext.increaseProgressCount();

    if (includingSubTree) {
        for (const child of note.getChildNotes()) {
            protectNoteRecursively(child, protect, includingSubTree, taskContext);
        }
    }
}

/**
 * @param {BNote} note
 * @param {boolean} protect
 */
function protectNote(note, protect) {
    if (!protectedSessionService.isProtectedSessionAvailable()) {
        throw new Error(`Cannot (un)protect note '${note.noteId}' with protect flag '${protect}' without active protected session`);
    }

    try {
        if (protect !== note.isProtected) {
            const content = note.getContent();

            note.isProtected = protect;
            note.setContent(content, { forceSave: true });
        }

        revisionService.protectRevisions(note);

        for (const attachment of note.getAttachments()) {
            if (protect !== attachment.isProtected) {
                try {
                    const content = attachment.getContent();

                    attachment.isProtected = protect;
                    attachment.setContent(content, {forceSave: true});
                }
                catch (e) {
                    log.error(`Could not un/protect attachment '${attachment.attachmentId}'`);

                    throw e;
                }
            }
        }
    }
    catch (e) {
        log.error(`Could not un/protect note '${note.noteId}'`);

        throw e;
    }
}

function checkImageAttachments(note, content) {
    const foundAttachmentIds = new Set();
    let match;

    const imgRegExp = /src="[^"]*api\/attachments\/([a-zA-Z0-9_]+)\/image/g;
    while (match = imgRegExp.exec(content)) {
        foundAttachmentIds.add(match[1]);
    }

    const linkRegExp = /href="[^"]+attachmentId=([a-zA-Z0-9_]+)/g;
    while (match = linkRegExp.exec(content)) {
        foundAttachmentIds.add(match[1]);
    }

    const attachments = note.getAttachments();

    for (const attachment of attachments) {
        const attachmentInContent = foundAttachmentIds.has(attachment.attachmentId);

        if (attachment.utcDateScheduledForErasureSince && attachmentInContent) {
            attachment.utcDateScheduledForErasureSince = null;
            attachment.save();
        } else if (!attachment.utcDateScheduledForErasureSince && !attachmentInContent) {
            attachment.utcDateScheduledForErasureSince = dateUtils.utcNowDateTime();
            attachment.save();
        }
    }

    const existingAttachmentIds = new Set(attachments.map(att => att.attachmentId));
    const unknownAttachmentIds = Array.from(foundAttachmentIds).filter(foundAttId => !existingAttachmentIds.has(foundAttId));
    const unknownAttachments = becca.getAttachments(unknownAttachmentIds);

    for (const unknownAttachment of unknownAttachments) {
        // the attachment belongs to a different note (was copy-pasted). Attachments can be linked only from the note
        // which owns it, so either find an existing attachment having the same content or make a copy.
        let localAttachment = note.getAttachments().find(att => att.role === unknownAttachment.role && att.blobId === unknownAttachment.blobId);

        if (localAttachment) {
            if (localAttachment.utcDateScheduledForErasureSince) {
                // the attachment is for sure linked now, so reset the scheduled deletion
                localAttachment.utcDateScheduledForErasureSince = null;
                localAttachment.save();
            }

            log.info(`Found equivalent attachment '${localAttachment.attachmentId}' of note '${note.noteId}' for the linked foreign attachment '${unknownAttachment.attachmentId}' of note '${unknownAttachment.ownerId}'`);
        } else {
            localAttachment = unknownAttachment.copy();
            localAttachment.ownerId = note.noteId;
            localAttachment.setContent(unknownAttachment.getContent(), {forceSave: true});

            ws.sendMessageToAllClients({ type: 'toast', message: `Attachment '${localAttachment.title}' has been copied to note '${note.title}'.`});
            log.info(`Copied attachment '${unknownAttachment.attachmentId}' of note '${unknownAttachment.ownerId}' to new '${localAttachment.attachmentId}' of note '${note.noteId}'`);
        }

        // replace image links
        content = content.replace(`api/attachments/${unknownAttachment.attachmentId}/image`, `api/attachments/${localAttachment.attachmentId}/image`);
        // replace reference links
        content = content.replace(new RegExp(`href="[^"]+attachmentId=${unknownAttachment.attachmentId}[^"]*"`, "g"),
            `href="#root/${localAttachment.ownerId}?viewMode=attachments&amp;attachmentId=${localAttachment.attachmentId}"`);
    }

    return {
        forceFrontendReload: unknownAttachments.length > 0,
        content
    };
}

function findImageLinks(content, foundLinks) {
    const re = /src="[^"]*api\/images\/([a-zA-Z0-9_]+)\//g;
    let match;

    while (match = re.exec(content)) {
        foundLinks.push({
            name: 'imageLink',
            value: match[1]
        });
    }

    // removing absolute references to server to keep it working between instances,
    // we also omit / at the beginning to keep the paths relative
    return content.replace(/src="[^"]*\/api\/images\//g, 'src="api/images/');
}

function findInternalLinks(content, foundLinks) {
    const re = /href="[^"]*#root[a-zA-Z0-9_\/]*\/([a-zA-Z0-9_]+)\/?"/g;
    let match;

    while (match = re.exec(content)) {
        foundLinks.push({
            name: 'internalLink',
            value: match[1]
        });
    }

    // removing absolute references to server to keep it working between instances
    return content.replace(/href="[^"]*#root/g, 'href="#root');
}

function findIncludeNoteLinks(content, foundLinks) {
    const re = /<section class="include-note[^>]+data-note-id="([a-zA-Z0-9_]+)"[^>]*>/g;
    let match;

    while (match = re.exec(content)) {
        foundLinks.push({
            name: 'includeNoteLink',
            value: match[1]
        });
    }

    return content;
}

function findRelationMapLinks(content, foundLinks) {
    const obj = JSON.parse(content);

    for (const note of obj.notes) {
        foundLinks.push({
            name: 'relationMapLink',
            value: note.noteId
        });
    }
}

const imageUrlToAttachmentIdMapping = {};

async function downloadImage(noteId, imageUrl) {
    const unescapedUrl = utils.unescapeHtml(imageUrl);

    try {
        let imageBuffer;

        if (imageUrl.toLowerCase().startsWith("file://")) {
            imageBuffer = await new Promise((res, rej) => {
                const localFilePath = imageUrl.substr("file://".length);

                return fs.readFile(localFilePath, (err, data) => {
                    if (err) {
                        rej(err);
                    } else {
                        res(data);
                    }
                });
            });
        } else {
            imageBuffer = await request.getImage(unescapedUrl);
        }

        const parsedUrl = url.parse(unescapedUrl);
        const title = path.basename(parsedUrl.pathname);

        const imageService = require('../services/image.js');
        const attachment = imageService.saveImageToAttachment(noteId, imageBuffer, title, true, true);

        imageUrlToAttachmentIdMapping[imageUrl] = attachment.attachmentId;

        log.info(`Download of '${imageUrl}' succeeded and was saved as image attachment '${attachment.attachmentId}' of note '${noteId}'`);
    }
    catch (e) {
        log.error(`Download of '${imageUrl}' for note '${noteId}' failed with error: ${e.message} ${e.stack}`);
    }
}

/** url => download promise */
const downloadImagePromises = {};

function replaceUrl(content, url, attachment) {
    const quotedUrl = utils.quoteRegex(url);

    return content.replace(new RegExp(`\\s+src=[\"']${quotedUrl}[\"']`, "ig"), ` src="api/attachments/${attachment.attachmentId}/image/${encodeURIComponent(attachment.title)}"`);
}

function downloadImages(noteId, content) {
    const imageRe = /<img[^>]*?\ssrc=['"]([^'">]+)['"]/ig;
    let imageMatch;

    while (imageMatch = imageRe.exec(content)) {
        const url = imageMatch[1];
        const inlineImageMatch = /^data:image\/[a-z]+;base64,/.exec(url);

        if (inlineImageMatch) {
            const imageBase64 = url.substr(inlineImageMatch[0].length);
            const imageBuffer = Buffer.from(imageBase64, 'base64');

            const imageService = require('../services/image.js');
            const attachment = imageService.saveImageToAttachment(noteId, imageBuffer, "inline image", true, true);

            const encodedTitle = encodeURIComponent(attachment.title);

            content = `${content.substr(0, imageMatch.index)}<img src="api/attachments/${attachment.attachmentId}/image/${encodedTitle}"${content.substr(imageMatch.index + imageMatch[0].length)}`;
        }
        else if (!url.includes('api/images/') && !/api\/attachments\/.+\/image\/?.*/.test(url)
            // this is an exception for the web clipper's "imageId"
            && (url.length !== 20 || url.toLowerCase().startsWith('http'))) {

            if (!optionService.getOptionBool("downloadImagesAutomatically")) {
                continue;
            }

            if (url in imageUrlToAttachmentIdMapping) {
                const attachment = becca.getAttachment(imageUrlToAttachmentIdMapping[url]);

                if (!attachment) {
                    delete imageUrlToAttachmentIdMapping[url];
                }
                else {
                    content = replaceUrl(content, url, attachment);
                    continue;
                }
            }

            if (url in downloadImagePromises) {
                // download is already in progress
                continue;
            }

            // this is done asynchronously, it would be too slow to wait for the download
            // given that save can be triggered very often
            downloadImagePromises[url] = downloadImage(noteId, url);
        }
    }

    Promise.all(Object.values(downloadImagePromises)).then(() => {
        setTimeout(() => {
            // the normal expected flow of the offline image saving is that users will paste the image(s)
            // which will get asynchronously downloaded, during that time they keep editing the note
            // once the download is finished, the image note representing the downloaded image will be used
            // to replace the IMG link.
            // However, there's another flow where the user pastes the image and leaves the note before the images
            // are downloaded and the IMG references are not updated. For this occasion we have this code
            // which upon the download of all the images will update the note if the links have not been fixed before

            sql.transactional(() => {
                const imageNotes = becca.getNotes(Object.values(imageUrlToAttachmentIdMapping), true);

                const origNote = becca.getNote(noteId);

                if (!origNote) {
                    log.error(`Cannot find note '${noteId}' to replace image link.`);
                    return;
                }

                const origContent = origNote.getContent();
                let updatedContent = origContent;

                for (const url in imageUrlToAttachmentIdMapping) {
                    const imageNote = imageNotes.find(note => note.noteId === imageUrlToAttachmentIdMapping[url]);

                    if (imageNote) {
                        updatedContent = replaceUrl(updatedContent, url, imageNote);
                    }
                }

                // update only if the links have not been already fixed.
                if (updatedContent !== origContent) {
                    origNote.setContent(updatedContent);

                    asyncPostProcessContent(origNote, updatedContent);

                    console.log(`Fixed the image links for note '${noteId}' to the offline saved.`);
                }
            });
        }, 5000);
    });

    return content;
}

/**
 * @param {BNote} note
 * @param {string} content
 */
function saveAttachments(note, content) {
    const inlineAttachmentRe = /<a[^>]*?\shref=['"]data:([^;'">]+);base64,([^'">]+)['"][^>]*>(.*?)<\/a>/igm;
    let attachmentMatch;

    while (attachmentMatch = inlineAttachmentRe.exec(content)) {
        const mime = attachmentMatch[1].toLowerCase();

        const base64data = attachmentMatch[2];
        const buffer = Buffer.from(base64data, 'base64');

        const title = html2plaintext(attachmentMatch[3]);

        const attachment = note.saveAttachment({
            role: 'file',
            mime: mime,
            title: title,
            content: buffer
        });

        content = `${content.substr(0, attachmentMatch.index)}<a class="reference-link" href="#root/${note.noteId}?viewMode=attachments&attachmentId=${attachment.attachmentId}">${title}</a>${content.substr(attachmentMatch.index + attachmentMatch[0].length)}`;
    }

    // removing absolute references to server to keep it working between instances,
    // we also omit / at the beginning to keep the paths relative
    content = content.replace(/src="[^"]*\/api\/attachments\//g, 'src="api/attachments/');

    return content;
}

/**
 * @param {BNote} note
 * @param {string} content
 */
function saveLinks(note, content) {
    if ((note.type !== 'text' && note.type !== 'relationMap')
        || (note.isProtected && !protectedSessionService.isProtectedSessionAvailable())) {
        return {
            forceFrontendReload: false,
            content
        };
    }

    const foundLinks = [];
    let forceFrontendReload = false;

    if (note.type === 'text') {
        content = downloadImages(note.noteId, content);
        content = saveAttachments(note, content);

        content = findImageLinks(content, foundLinks);
        content = findInternalLinks(content, foundLinks);
        content = findIncludeNoteLinks(content, foundLinks);

        ({forceFrontendReload, content} = checkImageAttachments(note, content));
    }
    else if (note.type === 'relationMap') {
        findRelationMapLinks(content, foundLinks);
    }
    else {
        throw new Error(`Unrecognized type '${note.type}'`);
    }

    const existingLinks = note.getRelations().filter(rel =>
        ['internalLink', 'imageLink', 'relationMapLink', 'includeNoteLink'].includes(rel.name));

    for (const foundLink of foundLinks) {
        const targetNote = becca.notes[foundLink.value];
        if (!targetNote) {
            continue;
        }

        const existingLink = existingLinks.find(existingLink =>
            existingLink.value === foundLink.value
            && existingLink.name === foundLink.name);

        if (!existingLink) {
            const newLink = new BAttribute({
                noteId: note.noteId,
                type: 'relation',
                name: foundLink.name,
                value: foundLink.value,
            }).save();

            existingLinks.push(newLink);
        }
        // else the link exists, so we don't need to do anything
    }

    // marking links as deleted if they are not present on the page anymore
    const unusedLinks = existingLinks.filter(existingLink => !foundLinks.some(foundLink =>
                                    existingLink.value === foundLink.value
                                    && existingLink.name === foundLink.name));

    for (const unusedLink of unusedLinks) {
        unusedLink.markAsDeleted();
    }

    return { forceFrontendReload, content };
}

/** @param {BNote} note */
function saveRevisionIfNeeded(note) {
    // files and images are versioned separately
    if (note.type === 'file' || note.type === 'image' || note.isLabelTruthy('disableVersioning')) {
        return;
    }

    const now = new Date();
    const revisionSnapshotTimeInterval = parseInt(optionService.getOption('revisionSnapshotTimeInterval'));

    const revisionCutoff = dateUtils.utcDateTimeStr(new Date(now.getTime() - revisionSnapshotTimeInterval * 1000));

    const existingRevisionId = sql.getValue(
        "SELECT revisionId FROM revisions WHERE noteId = ? AND utcDateCreated >= ?", [note.noteId, revisionCutoff]);

    const msSinceDateCreated = now.getTime() - dateUtils.parseDateTime(note.utcDateCreated).getTime();

    if (!existingRevisionId && msSinceDateCreated >= revisionSnapshotTimeInterval * 1000) {
        note.saveRevision();
    }
}

function updateNoteData(noteId, content, attachments = []) {
    const note = becca.getNote(noteId);

    if (!note.isContentAvailable()) {
        throw new Error(`Note '${noteId}' is not available for change!`);
    }

    saveRevisionIfNeeded(note);

    const { forceFrontendReload, content: newContent } = saveLinks(note, content);

    note.setContent(newContent, { forceFrontendReload });

    if (attachments?.length > 0) {
        /** @var {Object<string, BAttachment>} */
        const existingAttachmentsByTitle = utils.toMap(note.getAttachments({includeContentLength: false}), 'title');

        for (const {attachmentId, role, mime, title, content, position} of attachments) {
            if (attachmentId || !(title in existingAttachmentsByTitle)) {
                note.saveAttachment({attachmentId, role, mime, title, content, position});
            } else {
                const existingAttachment = existingAttachmentsByTitle[title];
                existingAttachment.role = role;
                existingAttachment.mime = mime;
                existingAttachment.position = position;
                existingAttachment.setContent(content, {forceSave: true});
            }
        }
    }
}

/**
 * @param {string} noteId
 * @param {TaskContext} taskContext
 */
function undeleteNote(noteId, taskContext) {
    const noteRow = sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteId]);

    if (!noteRow.isDeleted) {
        log.error(`Note '${noteId}' is not deleted and thus cannot be undeleted.`);
        return;
    }

    const undeletedParentBranchIds = getUndeletedParentBranchIds(noteId, noteRow.deleteId);

    if (undeletedParentBranchIds.length === 0) {
        // cannot undelete if there's no undeleted parent
        return;
    }

    for (const parentBranchId of undeletedParentBranchIds) {
        undeleteBranch(parentBranchId, noteRow.deleteId, taskContext);
    }
}

/**
 * @param {string} branchId
 * @param {string} deleteId
 * @param {TaskContext} taskContext
 */
function undeleteBranch(branchId, deleteId, taskContext) {
    const branchRow = sql.getRow("SELECT * FROM branches WHERE branchId = ?", [branchId])

    if (!branchRow.isDeleted) {
        return;
    }

    const noteRow = sql.getRow("SELECT * FROM notes WHERE noteId = ?", [branchRow.noteId]);

    if (noteRow.isDeleted && noteRow.deleteId !== deleteId) {
        return;
    }

    new BBranch(branchRow).save();

    taskContext.increaseProgressCount();

    if (noteRow.isDeleted && noteRow.deleteId === deleteId) {
        // becca entity was already created as skeleton in "new Branch()" above
        const noteEntity = becca.getNote(noteRow.noteId);
        noteEntity.updateFromRow(noteRow);
        noteEntity.save();

        const attributeRows = sql.getRows(`
                SELECT * FROM attributes 
                WHERE isDeleted = 1 
                  AND deleteId = ? 
                  AND (noteId = ? 
                           OR (type = 'relation' AND value = ?))`, [deleteId, noteRow.noteId, noteRow.noteId]);

        for (const attributeRow of attributeRows) {
            // relation might point to a note which hasn't been undeleted yet and would thus throw up
            new BAttribute(attributeRow).save({skipValidation: true});
        }

        const attachmentRows = sql.getRows(`
            SELECT * FROM attachments
            WHERE isDeleted = 1
              AND deleteId = ?
              AND ownerId = ?`, [deleteId, noteRow.noteId]);

        for (const attachmentRow of attachmentRows) {
            new BAttachment(attachmentRow).save();
        }

        const childBranchIds = sql.getColumn(`
            SELECT branches.branchId
            FROM branches
            WHERE branches.isDeleted = 1
              AND branches.deleteId = ?
              AND branches.parentNoteId = ?`, [deleteId, noteRow.noteId]);

        for (const childBranchId of childBranchIds) {
            undeleteBranch(childBranchId, deleteId, taskContext);
        }
    }
}

/**
 * @returns return deleted branchIds of an undeleted parent note
 */
function getUndeletedParentBranchIds(noteId, deleteId) {
    return sql.getColumn(`
                    SELECT branches.branchId
                    FROM branches
                    JOIN notes AS parentNote ON parentNote.noteId = branches.parentNoteId
                    WHERE branches.noteId = ?
                      AND branches.isDeleted = 1
                      AND branches.deleteId = ?
                      AND parentNote.isDeleted = 0`, [noteId, deleteId]);
}

function scanForLinks(note, content) {
    if (!note || !['text', 'relationMap'].includes(note.type)) {
        return;
    }

    try {
        sql.transactional(() => {
            const { forceFrontendReload, content: newContent } = saveLinks(note, content);

            if (content !== newContent) {
                note.setContent(newContent, { forceFrontendReload });
            }
        });
    }
    catch (e) {
        log.error(`Could not scan for links note '${note.noteId}': ${e.message} ${e.stack}`);
    }
}

/**
 * @param {BNote} note
 * @param {string} content
 * Things which have to be executed after updating content, but asynchronously (separate transaction)
 */
async function asyncPostProcessContent(note, content) {
    if (cls.isMigrationRunning()) {
        // this is rarely needed for migrations, but can cause trouble by e.g. triggering downloads
        return;
    }

    if (note.hasStringContent() && !utils.isString(content)) {
        content = content.toString();
    }

    scanForLinks(note, content);
}

// all keys should be replaced by the corresponding values
function replaceByMap(str, mapObj) {
    if (!mapObj) {
        return str;
    }

    const re = new RegExp(Object.keys(mapObj).join("|"),"g");

    return str.replace(re, matched => mapObj[matched]);
}

function duplicateSubtree(origNoteId, newParentNoteId) {
    if (origNoteId === 'root') {
        throw new Error('Duplicating root is not possible');
    }

    log.info(`Duplicating '${origNoteId}' subtree into '${newParentNoteId}'`);

    const origNote = becca.notes[origNoteId];
    // might be null if orig note is not in the target newParentNoteId
    const origBranch = origNote.getParentBranches().find(branch => branch.parentNoteId === newParentNoteId);

    const noteIdMapping = getNoteIdMapping(origNote);

    const res = duplicateSubtreeInner(origNote, origBranch, newParentNoteId, noteIdMapping);

    if (!res.note.title.endsWith('(dup)')) {
        res.note.title += " (dup)";
    }

    res.note.save();

    return res;
}

function duplicateSubtreeWithoutRoot(origNoteId, newNoteId) {
    if (origNoteId === 'root') {
        throw new Error('Duplicating root is not possible');
    }

    const origNote = becca.getNote(origNoteId);
    const noteIdMapping = getNoteIdMapping(origNote);

    for (const childBranch of origNote.getChildBranches()) {
        duplicateSubtreeInner(childBranch.getNote(), childBranch, newNoteId, noteIdMapping);
    }
}

function duplicateSubtreeInner(origNote, origBranch, newParentNoteId, noteIdMapping) {
    if (origNote.isProtected && !protectedSessionService.isProtectedSessionAvailable()) {
        throw new Error(`Cannot duplicate note '${origNote.noteId}' because it is protected and protected session is not available. Enter protected session and try again.`);
    }

    const newNoteId = noteIdMapping[origNote.noteId];

    function createDuplicatedBranch() {
        return new BBranch({
            noteId: newNoteId,
            parentNoteId: newParentNoteId,
            // here increasing just by 1 to make sure it's directly after original
            notePosition: origBranch ? origBranch.notePosition + 1 : null
        }).save();
    }

    function createDuplicatedNote() {
        const newNote = new BNote({
            ...origNote,
            noteId: newNoteId,
            dateCreated: dateUtils.localNowDateTime(),
            utcDateCreated: dateUtils.utcNowDateTime()
        }).save();

        let content = origNote.getContent();

        if (['text', 'relationMap', 'search'].includes(origNote.type)) {
            // fix links in the content
            content = replaceByMap(content, noteIdMapping);
        }

        newNote.setContent(content);

        for (const attribute of origNote.getOwnedAttributes()) {
            const attr = new BAttribute({
                ...attribute,
                attributeId: undefined,
                noteId: newNote.noteId
            });

            // if relation points to within the duplicated tree then replace the target to the duplicated note
            // if it points outside of duplicated tree then keep the original target
            if (attr.type === 'relation' && attr.value in noteIdMapping) {
                attr.value = noteIdMapping[attr.value];
            }

            // the relation targets may not be created yet, the mapping is pre-generated
            attr.save({skipValidation: true});
        }

        for (const childBranch of origNote.getChildBranches()) {
            duplicateSubtreeInner(childBranch.getNote(), childBranch, newNote.noteId, noteIdMapping);
        }

        return newNote;
    }

    const existingNote = becca.notes[newNoteId];

    if (existingNote && existingNote.title !== undefined) { // checking that it's not just note's skeleton created because of Branch above
        // note has multiple clones and was already created from another placement in the tree,
        // so a branch is all we need for this clone
        return {
            note: existingNote,
            branch: createDuplicatedBranch()
        }
    }
    else {
        return {
            // order here is important, note needs to be created first to not mess up the becca
            note: createDuplicatedNote(),
            branch: createDuplicatedBranch()
        }
    }
}

function getNoteIdMapping(origNote) {
    const noteIdMapping = {};

    // pregenerate new noteIds since we'll need to fix relation references even for not yet created notes
    for (const origNoteId of origNote.getDescendantNoteIds()) {
        noteIdMapping[origNoteId] = utils.newEntityId();
    }

    return noteIdMapping;
}

module.exports = {
    createNewNote,
    createNewNoteWithTarget,
    updateNoteData,
    undeleteNote,
    protectNoteRecursively,
    duplicateSubtree,
    duplicateSubtreeWithoutRoot,
    getUndeletedParentBranchIds,
    triggerNoteTitleChanged,
    saveRevisionIfNeeded,
    downloadImages,
    asyncPostProcessContent
};
