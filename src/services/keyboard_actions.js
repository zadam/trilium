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
        actionName: "BackInNoteHistory",
        // Mac has a different history navigation shortcuts - https://github.com/zadam/trilium/issues/376
        defaultShortcuts: isMac ? ["Meta+Left"] : ["Alt+Left"],
        scope: "window"
    },
    {
        actionName: "ForwardInNoteHistory",
        // Mac has a different history navigation shortcuts - https://github.com/zadam/trilium/issues/376
        defaultShortcuts: isMac ? ["Meta+Right"] : ["Alt+Right"],
        scope: "window"
    },
    {
        actionName: "JumpToNote",
        defaultShortcuts: ["CommandOrControl+J"],
        description: 'Open "Jump to note" dialog',
        scope: "window"
    },
    {
        actionName: "ScrollToActiveNote",
        defaultShortcuts: ["CommandOrControl+."],
        scope: "window" // FIXME - how do we find what note tree should be updated?
    },
    {
        actionName: "SearchNotes",
        defaultShortcuts: ["CommandOrControl+S"],
        scope: "window"
    },
    {
        actionName: "SearchInSubtree",
        defaultShortcuts: ["CommandOrControl+Shift+S"],
        description: "Search for notes in the active note's subtree",
        scope: "note-tree"
    },
    {
        actionName: "CollapseTree",
        defaultShortcuts: ["Alt+C"],
        scope: "note-tree"
    },
    {
        actionName: "CollapseSubtree",
        defaultShortcuts: ["Alt+-"],
        description: "Collapses subtree of current note",
        scope: "note-tree"
    },
    {
        actionName: "ActivateParentNote",
        defaultShortcuts: ["Backspace"],
        description: "Activates the parent note of currently active note",
        scope: "note-tree"
    },
    {
        actionName: "SortChildNotes",
        defaultShortcuts: ["Alt+S"],
        description: "Sort child notes",
        scope: "note-tree"
    },


    {
        separator: "Creating and moving notes"
    },
    {
        actionName: "CreateNoteAfter",
        defaultShortcuts: ["CommandOrControl+O"],
        scope: "window"
    },
    {
        actionName: "CreateNoteInto",
        defaultShortcuts: ["CommandOrControl+P"],
        scope: "window"
    },
    {
        actionName: "CreateNoteIntoDayNote",
        defaultShortcuts: ["global:CommandOrControl+Alt+P"],
        description: "Create and open subnote of a current day note",
        scope: "window"
    },
    {
        actionName: "DeleteNotes",
        defaultShortcuts: ["Delete"],
        description: "Delete note",
        scope: "note-tree"
    },
    {
        actionName: "MoveNoteUp",
        defaultShortcuts: ["CommandOrControl+Up"],
        description: "Move note up",
        scope: "note-tree"
    },
    {
        actionName: "MoveNoteDown",
        defaultShortcuts: ["CommandOrControl+Down"],
        description: "Move note down",
        scope: "note-tree"
    },
    {
        actionName: "MoveNoteUpInHierarchy",
        defaultShortcuts: ["CommandOrControl+Left"],
        description: "Move note up in hierarchy",
        scope: "note-tree"
    },
    {
        actionName: "MoveNoteDownInHierarchy",
        defaultShortcuts: ["CommandOrControl+Right"],
        description: "Move note down in hierarchy",
        scope: "note-tree"
    },
    {
        actionName: "EditNoteTitle",
        defaultShortcuts: ["Enter"],
        description: "Jump from tree to the note detail and edit title",
        scope: "note-tree"
    },
    {
        actionName: "EditBranchPrefix",
        defaultShortcuts: ["F2"],
        description: "Show Edit branch prefix dialog",
        scope: "window"
    },
    {
        actionName: "CloneNotesTo",
        defaultShortcuts: ["CommandOrControl+Shift+C"],
        scope: "window"
    },
    {
        actionName: "MoveNotesTo",
        defaultShortcuts: ["CommandOrControl+Shift+X"],
        scope: "window"
    },

    {
        separator: "Note clipboard"
    },


    {
        actionName: "CopyNotesToClipboard",
        defaultShortcuts: ["CommandOrControl+C"],
        description: "Copy selected notes to the clipboard",
        scope: "note-tree"
    },
    {
        actionName: "PasteNotesFromClipboard",
        defaultShortcuts: ["CommandOrControl+V"],
        description: "Paste notes from the clipboard into active note",
        scope: "note-tree"
    },
    {
        actionName: "CutNotesToClipboard",
        defaultShortcuts: ["CommandOrControl+X"],
        description: "Cut selected notes to the clipboard",
        scope: "note-tree"
    },
    {
        actionName: "SelectAllNotesInParent",
        defaultShortcuts: ["CommandOrControl+A"],
        description: "Select all notes from the current note level",
        scope: "note-tree"
    },
    {
        actionName: "AddNoteAboveToSelection",
        defaultShortcuts: ["Shift+Up"],
        description: "Add note above to the selection",
        scope: "note-tree"
    },
    {
        actionName: "AddNoteBelowToSelection",
        defaultShortcuts: ["Shift+Down"],
        description: "Add note above to the selection",
        scope: "note-tree"
    },


    {
        separator: "Tabs"
    },
    {
        actionName: "OpenNewTab",
        defaultShortcuts: isElectron ? ["CommandOrControl+T"] : [],
        description: "Opens new tab",
        scope: "window"
    },
    {
        actionName: "CloseActiveTab",
        defaultShortcuts: isElectron ? ["CommandOrControl+W"] : [],
        description: "Closes active tab",
        scope: "window"
    },
    {
        actionName: "ActivateNextTab",
        defaultShortcuts: isElectron ? ["CommandOrControl+Tab"] : [],
        description: "Activates tab on the right",
        scope: "window"
    },
    {
        actionName: "ActivatePreviousTab",
        defaultShortcuts: isElectron ? ["CommandOrControl+Shift+Tab"] : [],
        description: "Activates tab on the left",
        scope: "window"
    },


    {
        separator: "Dialogs"
    },
    {
        actionName: "ShowAttributes",
        defaultShortcuts: ["Alt+A"],
        description: "Shows Attributes dialog",
        scope: "window"
    },
    {
        actionName: "ShowNoteInfo",
        defaultShortcuts: [],
        description: "Shows Note Info dialog",
        scope: "window"
    },
    {
        actionName: "ShowNoteSource",
        defaultShortcuts: [],
        description: "Shows Note Source dialog",
        scope: "window"
    },
    {
        actionName: "ShowLinkMap",
        defaultShortcuts: [],
        description: "Shows Link Map dialog",
        scope: "window"
    },
    {
        actionName: "ShowOptions",
        defaultShortcuts: [],
        description: "Shows Options dialog",
        scope: "window"
    },
    {
        actionName: "ShowNoteRevisions",
        defaultShortcuts: [],
        description: "Shows Note Revisions dialog",
        scope: "window"
    },
    {
        actionName: "ShowRecentChanges",
        defaultShortcuts: [],
        description: "Shows Recent Changes dialog",
        scope: "window"
    },
    {
        actionName: "ShowSQLConsole",
        defaultShortcuts: ["Alt+O"],
        description: "Shows SQL Console dialog",
        scope: "window"
    },
    {
        actionName: "ShowBackendLog",
        defaultShortcuts: [],
        description: "Shows Backend Log dialog",
        scope: "window"
    },
    {
        actionName: "ShowHelp",
        defaultShortcuts: ["F1"],
        description: "Shows built-in Help / cheatsheet",
        scope: "window"
    },


    {
        separator: "Text note operations"
    },

    {
        actionName: "AddLinkToText",
        defaultShortcuts: ["CommandOrControl+L"],
        description: "Open dialog to add link to the text",
        scope: "text-detail"
    },
    {
        actionName: "InsertDateTimeToText",
        defaultShortcuts: ["Alt+T"],
        scope: "text-detail"
    },
    {
        actionName: "PasteMarkdownIntoText",
        defaultShortcuts: [],
        description: "Pastes Markdown from clipboard into text note",
        scope: "text-detail"
    },
    {
        actionName: "CutIntoNote",
        defaultShortcuts: [],
        description: "Cuts the selection from the current note and creates subnote with the selected text",
        scope: "text-detail"
    },

    {
        separator: "Other"
    },

    {
        actionName: "PrintActiveNote",
        defaultShortcuts: [],
        scope: "note-detail"
    },
    {
        actionName: "RunActiveNote",
        defaultShortcuts: ["CommandOrControl+Enter"],
        description: "Run active JavaScript (frontend/backend) code note",
        scope: "code-detail"
    },
    {
        actionName: "ToggleNoteHoisting",
        defaultShortcuts: ["Alt+H"],
        description: "Toggles note hoisting of active note",
        scope: "window"
    },
    {
        actionName: "ReloadFrontendApp",
        defaultShortcuts: ["F5", "CommandOrControl+R"],
        scope: "window"
    },
    {
        actionName: "OpenDevTools",
        defaultShortcuts: ["CommandOrControl+Shift+I"],
        scope: "window"
    },
    {
        actionName: "FindInText",
        defaultShortcuts: ["CommandOrControl+F"],
        scope: "window"
    },
    {
        actionName: "ToggleFullscreen",
        defaultShortcuts: ["F11"],
        scope: "window"
    },
    {
        actionName: "ToggleZenMode",
        defaultShortcuts: ["Alt+M"],
        scope: "window"
    },
    {
        actionName: "ZoomOut",
        defaultShortcuts: ["CommandOrControl+-"],
        scope: "window"
    },
    {
        actionName: "ZoomIn",
        defaultShortcuts: ["CommandOrControl+="],
        scope: "window"
    },
    {
        actionName: "CopyWithoutFormatting",
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
            const actionName = option.name.substr(17);

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