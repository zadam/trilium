"use strict";

const becca = require("../../becca/becca");
const { JSDOM } = require("jsdom");

function buildDescendantCountMap() {
    const noteIdToCountMap = {};

    function getCount(noteId) {
        if (!(noteId in noteIdToCountMap)) {
            const note = becca.getNote(noteId);

            noteIdToCountMap[noteId] = note.children.length;

            for (const child of note.children) {
                noteIdToCountMap[noteId] += getCount(child.noteId);
            }
        }

        return noteIdToCountMap[noteId];
    }

    getCount('root');

    return noteIdToCountMap;
}

function getNeighbors(note, depth) {
    if (depth === 0) {
        return [];
    }

    const retNoteIds = [];

    function isIgnoredRelation(relation) {
        return ['relationMapLink', 'template', 'image'].includes(relation.name);
    }

    // forward links
    for (const relation of note.getRelations()) {
        if (isIgnoredRelation(relation)) {
            continue;
        }

        const targetNote = relation.getTargetNote();
        retNoteIds.push(targetNote.noteId);

        for (const noteId of getNeighbors(targetNote, depth - 1)) {
            retNoteIds.push(noteId);
        }
    }

    // backward links
    for (const relation of note.getTargetRelations()) {
        if (isIgnoredRelation(relation)) {
            continue;
        }

        const sourceNote = relation.getNote();
        retNoteIds.push(sourceNote.noteId);

        for (const noteId of getNeighbors(sourceNote, depth - 1)) {
            retNoteIds.push(noteId);
        }
    }

    return retNoteIds;
}

function getLinkMap(req) {
    const mapRootNote = becca.getNote(req.params.noteId);
    // if the map root itself has ignore (journal typically) then there wouldn't be anything to display so
    // we'll just ignore it
    const ignoreExcludeFromNoteMap = mapRootNote.hasLabel('excludeFromNoteMap');

    const noteIds = new Set(
        mapRootNote.getSubtreeNotes(false)
            .filter(note => ignoreExcludeFromNoteMap || !note.hasLabel('excludeFromNoteMap'))
            .map(note => note.noteId)
    );

    for (const noteId of getNeighbors(mapRootNote, 3)) {
        noteIds.add(noteId);
    }

    const notes = Array.from(noteIds).map(noteId => {
        const note = becca.getNote(noteId);

        return [
            note.noteId,
            note.isContentAvailable() ? note.title : '[protected]',
            note.type
        ];
    });

    const links = Object.values(becca.attributes).filter(rel => {
        if (rel.type !== 'relation' || rel.name === 'relationMapLink' || rel.name === 'template') {
            return false;
        }
        else if (!noteIds.has(rel.noteId) || !noteIds.has(rel.value)) {
            return false;
        }
        else if (rel.name === 'imageLink') {
            const parentNote = becca.getNote(rel.noteId);

            return !parentNote.getChildNotes().find(childNote => childNote.noteId === rel.value);
        }
        else {
            return true;
        }
    })
        .map(rel => ({
        id: rel.noteId + "-" + rel.name + "-" + rel.value,
        sourceNoteId: rel.noteId,
        targetNoteId: rel.value,
        name: rel.name
    }));

    return {
        notes: notes,
        noteIdToDescendantCountMap: buildDescendantCountMap(),
        links: links
    };
}

function getTreeMap(req) {
    const mapRootNote = becca.getNote(req.params.noteId);
    // if the map root itself has ignore (journal typically) then there wouldn't be anything to display so
    // we'll just ignore it
    const ignoreExcludeFromNoteMap = mapRootNote.hasLabel('excludeFromNoteMap');
    const noteIds = new Set();

    const notes = mapRootNote.getSubtreeNotes(false)
        .filter(note => ignoreExcludeFromNoteMap || !note.hasLabel('excludeFromNoteMap'))
        .filter(note => {
            if (note.type !== 'image' || note.getChildNotes().length > 0) {
                return true;
            }

            const imageLinkRelation = note.getTargetRelations().find(rel => rel.name === 'imageLink');

            if (!imageLinkRelation) {
                return true;
            }

            return !note.getParentNotes().find(parentNote => parentNote.noteId === imageLinkRelation.noteId);
        })
        .concat(...mapRootNote.getParentNotes())
        .map(note => [
            note.noteId,
            note.isContentAvailable() ? note.title : '[protected]',
            note.type
        ]);

    notes.forEach(([noteId]) => noteIds.add(noteId));

    const links = [];

    for (const branch of Object.values(becca.branches)) {
        if (!noteIds.has(branch.parentNoteId) || !noteIds.has(branch.noteId)) {
            continue;
        }

        links.push({
            id: branch.branchId,
            sourceNoteId: branch.parentNoteId,
            targetNoteId: branch.noteId
        });
    }

    return {
        notes: notes,
        noteIdToDescendantCountMap: buildDescendantCountMap(),
        links: links
    };
}

function removeImages(document) {
    const images = document.getElementsByTagName('img');
    while (images.length > 0) {
        images[0].parentNode.removeChild(images[0]);
    }
}

function getBacklinks(req) {
    const {noteId} = req.params;
    const note = becca.getNote(noteId);

    if (!note) {
        return [404, `Note ${noteId} was not found`];
    }

    let backlinks = note.getTargetRelations();

    if (backlinks.length > 50) {
        backlinks = backlinks.slice(0, 50);
    }

    return backlinks.map(backlink => {
        const sourceNote = backlink.note;

        const html = sourceNote.getContent();
        const dom = new JSDOM(html);

        const excerpts = [];

        const document = dom.window.document;

        removeImages(document);

        for (const linkEl of document.querySelectorAll("a")) {
            const href = linkEl.getAttribute("href");

            if (!href || !href.includes(noteId)) {
                continue;
            }

            linkEl.style.fontWeight = "bold";
            linkEl.style.backgroundColor = "yellow";

            const LIMIT = 200;
            let centerEl = linkEl;

            while (centerEl.tagName !== 'BODY' && centerEl.parentElement.textContent.length < LIMIT) {
                centerEl = centerEl.parentElement;
            }

            const sub = [centerEl];
            let counter = centerEl.textContent.length;
            let left = centerEl;
            let right = centerEl;

            while (true) {
                let added = false;

                const prev = left.previousElementSibling;

                if (prev) {
                    const prevText = prev.textContent;

                    if (prevText.length + counter > LIMIT) {
                        const prefix = prevText.substr(prevText.length - (LIMIT - counter));

                        const textNode = document.createTextNode("…" + prefix);
                        sub.unshift(textNode);

                        break;
                    }

                    left = prev;
                    sub.unshift(left);
                    counter += prevText.length;
                    added = true;
                }

                const next = right.nextElementSibling;

                if (next) {
                    const nextText = next.textContent;

                    if (nextText.length + counter > LIMIT) {
                        const suffix = nextText.substr(nextText.length - (LIMIT - counter));

                        const textNode = document.createTextNode(suffix + "…");
                        sub.push(textNode);

                        break;
                    }

                    right = next;
                    sub.push(right);
                    counter += nextText.length;
                    added = true;
                }

                if (!added) {
                    break;
                }
            }

            const div = document.createElement('div');
            div.classList.add("ck-content");
            div.classList.add("backlink-excerpt");

            for (const childEl of sub) {
                div.appendChild(childEl);
            }

            const subHtml = div.outerHTML;

            excerpts.push(subHtml);
        }

        return {
            noteId: sourceNote.noteId,
            excerpts
        };
    });
}

module.exports = {
    getLinkMap,
    getTreeMap,
    getBacklinks
};
