import ws from './ws.js';
import utils from './utils.js';
import server from './server.js';
import froca from './froca.js';
import hoistedNoteService from '../services/hoisted_note.js';
import appContext from "./app_context.js";

/**
 * @return {string|null}
 */
async function resolveNotePath(notePath, hoistedNoteId = 'root') {
    const runPath = await resolveNotePathToSegments(notePath, hoistedNoteId);

    return runPath ? runPath.join("/") : null;
}

/**
 * Accepts notePath which might or might not be valid and returns an existing path as close to the original
 * notePath as possible. Part of the path might not be valid because of note moving (which causes
 * path change) or other corruption, in that case this will try to get some other valid path to the correct note.
 *
 * @return {string[]}
 */
async function resolveNotePathToSegments(notePath, hoistedNoteId = 'root', logErrors = true) {
    utils.assertArguments(notePath);

    // we might get notePath with the ntxId suffix, remove it if present
    notePath = notePath.split("-")[0].trim();

    if (notePath.length === 0) {
        return;
    }

    const path = notePath.split("/").reverse();

    if (!path.includes("root")) {
        path.push('root');
    }

    const effectivePathSegments = [];
    let childNoteId = null;
    let i = 0;

    while (true) {
        if (i >= path.length) {
            break;
        }

        const parentNoteId = path[i++];

        if (childNoteId !== null) {
            const child = await froca.getNote(childNoteId, !logErrors);

            if (!child) {
                if (logErrors) {
                    ws.logError(`Can't find note ${childNoteId}`);
                }

                return;
            }

            child.resortParents();

            const parents = child.getParentNotes();

            if (!parents.length) {
                if (logErrors) {
                    ws.logError(`No parents found for ${childNoteId} (${child.title}) for path ${notePath}`);
                }

                return;
            }

            if (!parents.some(p => p.noteId === parentNoteId)) {
                if (logErrors) {
                    const parent = froca.getNoteFromCache(parentNoteId);

                    console.debug(utils.now(), `Did not find parent ${parentNoteId} (${parent ? parent.title : 'n/a'}) 
                        for child ${childNoteId} (${child.title}), available parents: ${parents.map(p => `${p.noteId} (${p.title})`)}. 
                        You can ignore this message as it is mostly harmless.`);
                }

                const someNotePath = getSomeNotePath(child, hoistedNoteId);

                if (someNotePath) { // in case it's root the path may be empty
                    const pathToRoot = someNotePath.split("/").reverse().slice(1);

                    if (!pathToRoot.includes("root")) {
                        pathToRoot.push('root');
                    }

                    for (const noteId of pathToRoot) {
                        effectivePathSegments.push(noteId);
                    }
                }

                break;
            }
        }

        effectivePathSegments.push(parentNoteId);
        childNoteId = parentNoteId;
    }

    effectivePathSegments.reverse();

    if (effectivePathSegments.includes(hoistedNoteId)) {
        return effectivePathSegments;
    }
    else {
        const note = await froca.getNote(getNoteIdFromNotePath(notePath));

        const someNotePathSegments = getSomeNotePathSegments(note, hoistedNoteId);

        if (!someNotePathSegments) {
            throw new Error(`Did not find any path segments for ${note.toString()}, hoisted note ${hoistedNoteId}`);
        }

        // if there isn't actually any note path with hoisted note then return the original resolved note path
        return someNotePathSegments.includes(hoistedNoteId) ? someNotePathSegments : effectivePathSegments;
    }
}

function getSomeNotePathSegments(note, hoistedNotePath = 'root') {
    utils.assertArguments(note);

    const notePaths = note.getSortedNotePaths(hoistedNotePath);

    return notePaths.length > 0 ? notePaths[0].notePath : null;
}

function getSomeNotePath(note, hoistedNotePath = 'root') {
    const notePath = getSomeNotePathSegments(note, hoistedNotePath);

    return notePath === null ? null : notePath.join('/');
}

async function sortAlphabetically(noteId) {
    await server.put(`notes/${noteId}/sort`);
}

ws.subscribeToMessages(message => {
   if (message.type === 'openNote') {
       appContext.tabManager.activateOrOpenNote(message.noteId);

       if (utils.isElectron()) {
           const currentWindow = utils.dynamicRequire('@electron/remote').getCurrentWindow();

           currentWindow.show();
       }
   }
});

function getParentProtectedStatus(node) {
    return hoistedNoteService.isHoistedNode(node) ? 0 : node.getParent().data.isProtected;
}

function getNoteIdFromNotePath(notePath) {
    if (!notePath) {
        return null;
    }

    const path = notePath.split("/");

    const lastSegment = path[path.length - 1];

    // path could have also ntxId suffix
    return lastSegment.split("-")[0];
}

async function getBranchIdFromNotePath(notePath) {
    const {noteId, parentNoteId} = getNoteIdAndParentIdFromNotePath(notePath);

    return await froca.getBranchId(parentNoteId, noteId);
}

function getNoteIdAndParentIdFromNotePath(notePath) {
    if (notePath === 'root') {
        return {
            noteId: 'root',
            parentNoteId: 'none'
        };
    }

    let parentNoteId = 'root';
    let noteId = '';

    if (notePath) {
        const path = notePath.split("/");

        const lastSegment = path[path.length - 1];

        // path could have also ntxId suffix
        noteId = lastSegment.split("-")[0];

        if (path.length > 1) {
            parentNoteId = path[path.length - 2];
        }
    }

    return {
        parentNoteId,
        noteId
    };
}

function getNotePath(node) {
    if (!node) {
        logError("Node is null");
        return "";
    }

    const path = [];

    while (node) {
        if (node.data.noteId) {
            path.push(node.data.noteId);
        }

        node = node.getParent();
    }

    return path.reverse().join("/");
}

async function getNoteTitle(noteId, parentNoteId = null) {
    utils.assertArguments(noteId);

    const note = await froca.getNote(noteId);
    if (!note) {
        return "[not found]";
    }

    let {title} = note;

    if (parentNoteId !== null) {
        const branchId = note.parentToBranch[parentNoteId];

        if (branchId) {
            const branch = froca.getBranch(branchId);

            if (branch && branch.prefix) {
                title = `${branch.prefix} - ${title}`;
            }
        }
    }

    return title;
}

async function getNotePathTitleComponents(notePath) {
    const titleComponents = [];

    if (notePath.startsWith('root/')) {
        notePath = notePath.substr(5);
    }

    // special case when we want just root's title
    if (notePath === 'root') {
        titleComponents.push(await getNoteTitle(notePath));
    } else {
        let parentNoteId = 'root';

        for (const noteId of notePath.split('/')) {
            titleComponents.push(await getNoteTitle(noteId, parentNoteId));

            parentNoteId = noteId;
        }
    }

    return titleComponents;
}

async function getNotePathTitle(notePath) {
    utils.assertArguments(notePath);

    const titlePath = await getNotePathTitleComponents(notePath);

    return titlePath.join(' / ');
}

async function getNoteTitleWithPathAsSuffix(notePath) {
    utils.assertArguments(notePath);

    const titleComponents = await getNotePathTitleComponents(notePath);

    if (!titleComponents || titleComponents.length === 0) {
        return "";
    }

    const title = titleComponents[titleComponents.length - 1];
    const path = titleComponents.slice(0, titleComponents.length - 1);

    const $titleWithPath = $('<span class="note-title-with-path">')
        .append($('<span class="note-title">').text(title));

    if (path.length > 0) {
        $titleWithPath
            .append($('<span class="note-path">').text(' (' + path.join(' / ') + ')'));
    }

    return $titleWithPath;
}

function getHashValueFromAddress() {
    const str = document.location.hash ? document.location.hash.substr(1) : ""; // strip initial #

    return str.split("-");
}

function parseNotePath(notePath) {
    let noteIds = notePath.split('/');

    if (noteIds[0] !== 'root') {
        noteIds = ['root'].concat(noteIds);
    }

    return noteIds;
}

export default {
    sortAlphabetically,
    resolveNotePath,
    resolveNotePathToSegments,
    getSomeNotePath,
    getSomeNotePathSegments,
    getParentProtectedStatus,
    getNotePath,
    getNoteIdFromNotePath,
    getNoteIdAndParentIdFromNotePath,
    getBranchIdFromNotePath,
    getNoteTitle,
    getNotePathTitle,
    getNoteTitleWithPathAsSuffix,
    getHashValueFromAddress,
    parseNotePath
};
