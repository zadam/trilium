"use strict";

const optionService = require('./options');
const log = require('./log');
const utils = require('./utils');

const isMac = process.platform === "darwin";
const isElectron = utils.isElectron();

const DEFAULT_KEYBOARD_ACTIONS = [
    {
        separator: "Note navigation"
    },
    {
        actionName: "backInNoteHistory",
        // Mac has a different history navigation shortcuts - https://github.com/zadam/trilium/issues/376
        defaultShortcuts: isMac ? ["Meta+Left"] : ["Alt+Left"],
        scope: "window"
    },
    {
        actionName: "forwardInNoteHistory",
        // Mac has a different history navigation shortcuts - https://github.com/zadam/trilium/issues/376
        defaultShortcuts: isMac ? ["Meta+Right"] : ["Alt+Right"],
        scope: "window"
    },
    {
        actionName: "jumpToNote",
        defaultShortcuts: ["CommandOrControl+J"],
        description: 'Open "Jump to note" dialog',
        scope: "window"
    },
    {
        actionName: "scrollToActiveNote",
        defaultShortcuts: ["CommandOrControl+."],
        scope: "window"
    },
    {
        actionName: "searchNotes",
        defaultShortcuts: ["CommandOrControl+S"],
        scope: "window"
    },
    {
        actionName: "searchInSubtree",
        defaultShortcuts: ["CommandOrControl+Shift+S"],
        description: "Search for notes in the active note's subtree",
        scope: "note-tree"
    },
    {
        actionName: "expandSubtree",
        defaultShortcuts: [],
        description: "Expand subtree of current note",
        scope: "note-tree"
    },
    {
        actionName: "collapseTree",
        defaultShortcuts: ["Alt+C"],
        description: "Collapses the complete note tree",
        scope: "window"
    },
    {
        actionName: "collapseSubtree",
        defaultShortcuts: ["Alt+-"],
        description: "Collapses subtree of current note",
        scope: "note-tree"
    },
    {
        actionName: "activateParentNote",
        defaultShortcuts: ["Backspace"],
        description: "Activates the parent note of currently active note",
        scope: "note-tree"
    },
    {
        actionName: "sortChildNotes",
        defaultShortcuts: ["Alt+S"],
        description: "Sort child notes",
        scope: "note-tree"
    },


    {
        separator: "Creating and moving notes"
    },
    {
        actionName: "createNoteAfter",
        defaultShortcuts: ["CommandOrControl+O"],
        scope: "window"
    },
    {
        actionName: "createNoteInto",
        defaultShortcuts: ["CommandOrControl+P"],
        scope: "window"
    },
    {
        actionName: "createNoteIntoDayNote",
        defaultShortcuts: ["global:CommandOrControl+Alt+P"],
        description: "Create and open subnote of a current day note",
        scope: "window"
    },
    {
        actionName: "deleteNotes",
        defaultShortcuts: ["Delete"],
        description: "Delete note",
        scope: "note-tree"
    },
    {
        actionName: "moveNoteUp",
        defaultShortcuts: ["CommandOrControl+Up"],
        description: "Move note up",
        scope: "note-tree"
    },
    {
        actionName: "moveNoteDown",
        defaultShortcuts: ["CommandOrControl+Down"],
        description: "Move note down",
        scope: "note-tree"
    },
    {
        actionName: "moveNoteUpInHierarchy",
        defaultShortcuts: ["CommandOrControl+Left"],
        description: "Move note up in hierarchy",
        scope: "note-tree"
    },
    {
        actionName: "moveNoteDownInHierarchy",
        defaultShortcuts: ["CommandOrControl+Right"],
        description: "Move note down in hierarchy",
        scope: "note-tree"
    },
    {
        actionName: "editNoteTitle",
        defaultShortcuts: ["Enter"],
        description: "Jump from tree to the note detail and edit title",
        scope: "note-tree"
    },
    {
        actionName: "editBranchPrefix",
        defaultShortcuts: ["F2"],
        description: "Show Edit branch prefix dialog",
        scope: "window"
    },
    {
        actionName: "cloneNotesTo",
        defaultShortcuts: ["CommandOrControl+Shift+C"],
        scope: "window"
    },
    {
        actionName: "moveNotesTo",
        defaultShortcuts: ["CommandOrControl+Shift+X"],
        scope: "window"
    },

    {
        separator: "Note clipboard"
    },


    {
        actionName: "copyNotesToClipboard",
        defaultShortcuts: ["CommandOrControl+C"],
        description: "Copy selected notes to the clipboard",
        scope: "note-tree"
    },
    {
        actionName: "pasteNotesFromClipboard",
        defaultShortcuts: ["CommandOrControl+V"],
        description: "Paste notes from the clipboard into active note",
        scope: "note-tree"
    },
    {
        actionName: "cutNotesToClipboard",
        defaultShortcuts: ["CommandOrControl+X"],
        description: "Cut selected notes to the clipboard",
        scope: "note-tree"
    },
    {
        actionName: "selectAllNotesInParent",
        defaultShortcuts: ["CommandOrControl+A"],
        description: "Select all notes from the current note level",
        scope: "note-tree"
    },
    {
        actionName: "addNoteAboveToSelection",
        defaultShortcuts: ["Shift+Up"],
        description: "Add note above to the selection",
        scope: "note-tree"
    },
    {
        actionName: "addNoteBelowToSelection",
        defaultShortcuts: ["Shift+Down"],
        description: "Add note above to the selection",
        scope: "note-tree"
    },


    {
        separator: "Tabs & Windows"
    },
    {
        actionName: "openNewTab",
        defaultShortcuts: isElectron ? ["CommandOrControl+T"] : [],
        description: "Opens new tab",
        scope: "window"
    },
    {
        actionName: "closeActiveTab",
        defaultShortcuts: isElectron ? ["CommandOrControl+W"] : [],
        description: "Closes active tab",
        scope: "window"
    },
    {
        actionName: "activateNextTab",
        defaultShortcuts: isElectron ? ["CommandOrControl+Tab"] : [],
        description: "Activates tab on the right",
        scope: "window"
    },
    {
        actionName: "activatePreviousTab",
        defaultShortcuts: isElectron ? ["CommandOrControl+Shift+Tab"] : [],
        description: "Activates tab on the left",
        scope: "window"
    },
    {
        actionName: "openNewWindow",
        defaultShortcuts: [],
        description: "Open new empty window",
        scope: "window"
    },


    {
        separator: "Dialogs"
    },
    {
        actionName: "showAttributes",
        defaultShortcuts: ["Alt+A"],
        description: "Shows Attributes dialog",
        scope: "window"
    },
    {
        actionName: "showNoteInfo",
        defaultShortcuts: [],
        description: "Shows Note Info dialog",
        scope: "window"
    },
    {
        actionName: "showNoteSource",
        defaultShortcuts: [],
        description: "Shows Note Source dialog",
        scope: "window"
    },
    {
        actionName: "showLinkMap",
        defaultShortcuts: [],
        description: "Shows Link Map dialog",
        scope: "window"
    },
    {
        actionName: "showOptions",
        defaultShortcuts: [],
        description: "Shows Options dialog",
        scope: "window"
    },
    {
        actionName: "showNoteRevisions",
        defaultShortcuts: [],
        description: "Shows Note Revisions dialog",
        scope: "window"
    },
    {
        actionName: "showRecentChanges",
        defaultShortcuts: [],
        description: "Shows Recent Changes dialog",
        scope: "window"
    },
    {
        actionName: "showSQLConsole",
        defaultShortcuts: ["Alt+O"],
        description: "Shows SQL Console dialog",
        scope: "window"
    },
    {
        actionName: "showBackendLog",
        defaultShortcuts: [],
        description: "Shows Backend Log dialog",
        scope: "window"
    },
    {
        actionName: "showHelp",
        defaultShortcuts: ["F1"],
        description: "Shows built-in Help / cheatsheet",
        scope: "window"
    },


    {
        separator: "Text note operations"
    },

    {
        actionName: "addLinkToText",
        defaultShortcuts: ["CommandOrControl+L"],
        description: "Open dialog to add link to the text",
        scope: "text-detail"
    },
    {
        actionName: "insertDateTimeToText",
        defaultShortcuts: ["Alt+T"],
        scope: "text-detail"
    },
    {
        actionName: "pasteMarkdownIntoText",
        defaultShortcuts: [],
        description: "Pastes Markdown from clipboard into text note",
        scope: "text-detail"
    },
    {
        actionName: "cutIntoNote",
        defaultShortcuts: [],
        description: "Cuts the selection from the current note and creates subnote with the selected text",
        scope: "text-detail"
    },

    {
        separator: "Other"
    },

    {
        actionName: "printActiveNote",
        defaultShortcuts: [],
        scope: "window"
    },
    {
        actionName: "runActiveNote",
        defaultShortcuts: ["CommandOrControl+Enter"],
        description: "Run active JavaScript (frontend/backend) code note",
        scope: "code-detail"
    },
    {
        actionName: "toggleNoteHoisting",
        defaultShortcuts: ["Alt+H"],
        description: "Toggles note hoisting of active note",
        scope: "window"
    },
    {
        actionName: "reloadFrontendApp",
        defaultShortcuts: ["F5", "CommandOrControl+R"],
        scope: "window"
    },
    {
        actionName: "openDevTools",
        defaultShortcuts: ["CommandOrControl+Shift+I"],
        scope: "window"
    },
    {
        actionName: "findInText",
        defaultShortcuts: ["CommandOrControl+F"],
        scope: "window"
    },
    {
        actionName: "toggleFullscreen",
        defaultShortcuts: ["F11"],
        scope: "window"
    },
    {
        actionName: "toggleZenMode",
        defaultShortcuts: ["Alt+M"],
        scope: "window"
    },
    {
        actionName: "zoomOut",
        defaultShortcuts: ["CommandOrControl+-"],
        scope: "window"
    },
    {
        actionName: "zoomIn",
        defaultShortcuts: ["CommandOrControl+="],
        scope: "window"
    },
    {
        actionName: "copyWithoutFormatting",
        defaultShortcuts: ["CommandOrControl+Alt+C"],
        scope: "text-detail"
    }
];

const platformModifier = isMac ? 'Meta' : 'Ctrl';

for (const action of DEFAULT_KEYBOARD_ACTIONS) {
    if (action.defaultShortcuts) {
        action.defaultShortcuts = action.defaultShortcuts.map(shortcut => shortcut.replace("CommandOrControl", platformModifier));
    }
}

async function getKeyboardActions() {
    const actions = JSON.parse(JSON.stringify(DEFAULT_KEYBOARD_ACTIONS));

    for (const action of actions) {
        action.effectiveShortcuts = action.effectiveShortcuts ? action.defaultShortcuts.slice() : [];
    }

    for (const option of await optionService.getOptions()) {
        if (option.name.startsWith('keyboardShortcuts')) {
            let actionName = option.name.substr(17);
            actionName = actionName.charAt(0).toLowerCase() + actionName.slice(1);

            const action = actions.find(ea => ea.actionName === actionName);

            if (action) {
                try {
                    action.effectiveShortcuts = JSON.parse(option.value);
                }
                catch (e) {
                    log.error(`Could not parse shortcuts for action ${actionName}`);
                }
            }
            else {
                log.info(`Keyboard action ${actionName} found in database, but not in action definition.`);
            }
        }
    }

    return actions;
}

module.exports = {
    DEFAULT_KEYBOARD_ACTIONS,
    getKeyboardActions
};
