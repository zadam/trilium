import treeCache from "./tree_cache.js";
import treeUtils from "./tree_utils.js";

async function getAutocompleteItems(parentNoteId, notePath, titlePath) {
    if (!parentNoteId) {
        parentNoteId = 'root';
    }

    const parentNote = await treeCache.getNote(parentNoteId);
    const childNotes = await parentNote.getChildNotes();

    if (!childNotes.length) {
        return [];
    }

    if (!notePath) {
        notePath = '';
    }

    if (!titlePath) {
        titlePath = '';
    }

    // https://github.com/zadam/trilium/issues/46
    // unfortunately not easy to implement because we don't have an easy access to note's isProtected property

    const autocompleteItems = [];

    for (const childNote of childNotes) {
        if (childNote.hideInAutocomplete) {
            continue;
        }

        const childNotePath = (notePath ? (notePath + '/') : '') + childNote.noteId;
        const childTitlePath = (titlePath ? (titlePath + ' / ') : '') + await treeUtils.getNoteTitle(childNote.noteId, parentNoteId);

        autocompleteItems.push({
            value: childTitlePath + ' (' + childNotePath + ')',
            label: childTitlePath
        });

        const childItems = await getAutocompleteItems(childNote.noteId, childNotePath, childTitlePath);

        for (const childItem of childItems) {
            autocompleteItems.push(childItem);
        }
    }

    if (parentNoteId === 'root') {
        console.log(`Generated ${autocompleteItems.length} autocomplete items`);
    }

    return autocompleteItems;
}

// Overrides the default autocomplete filter function to search for matched on atleast 1 word in each of the input term's words
$.ui.autocomplete.filter = (array, terms) => {
    if (!terms) {
        return array;
    }

    const startDate = new Date();

    const results = [];
    const tokens = terms.toLowerCase().split(" ");

    for (const item of array) {
        const lcLabel = item.label.toLowerCase();

        const found = tokens.every(token => lcLabel.indexOf(token) !== -1);
        if (!found) {
            continue;
        }

        // this is not completely correct and might cause minor problems with note with names containing this " / "
        const lastSegmentIndex = lcLabel.lastIndexOf(" / ");

        if (lastSegmentIndex !== -1) {
            const lastSegment = lcLabel.substr(lastSegmentIndex + 3);

            // at least some token needs to be in the last segment (leaf note), otherwise this
            // particular note is not that interesting (query is satisfied by parent note)
            const foundInLastSegment = tokens.some(token => lastSegment.indexOf(token) !== -1);

            if (!foundInLastSegment) {
                continue;
            }
        }

        results.push(item);

        if (results.length > 100) {
            break;
        }
    }

    console.log("Search took " + (new Date().getTime() - startDate.getTime()) + "ms");

    return results;
};

export default {
    getAutocompleteItems
};