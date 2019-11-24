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
        defaultShortcuts: isMac ? ["Meta+Left"] : ["Alt+Left"]
    },
    {
        actionName: "ForwardInNoteHistory",
        // Mac has a different history navigation shortcuts - https://github.com/zadam/trilium/issues/376
        defaultShortcuts: isMac ? ["Meta+Right"] : ["Alt+Right"]
    },
    {
        actionName: "JumpToNote",
        defaultShortcuts: ["CommandOrControl+J"],
        description: 'Open "Jump to note" dialog'
    },
    {
        actionName: "ScrollToActiveNote",
        defaultShortcuts: ["CommandOrControl+."]
    },
    {
        actionName: "SearchNotes",
        defaultShortcuts: ["CommandOrControl+S"]
    },
    {
        actionName: "SearchInSubtree",
        defaultShortcuts: ["CommandOrControl+Shift+S"],
        description: "Search for notes in the active note's subtree"
    },
    {
        actionName: "CollapseTree",
        defaultShortcuts: ["Alt+C"]
    },
    {
        actionName: "CollapseSubtree",
        defaultShortcuts: ["Alt+-"],
        description: "Collapses subtree of current note"
    },
    {
        actionName: "ActivateParentNote",
        defaultShortcuts: ["Backspace"],
        description: "Activates the parent note of currently active note"
    },
    {
        actionName: "SortChildNotes",
        defaultShortcuts: ["Alt+S"],
        description: "Sort child notes"
    },


    {
        separator: "Creating and moving notes"
    },
    {
        actionName: "CreateNoteAfter",
        defaultShortcuts: ["CommandOrControl+O"]
    },
    {
        actionName: "CreateNoteInto",
        defaultShortcuts: ["CommandOrControl+P"]
    },
    {
        actionName: "CreateNoteIntoDayNote",
        defaultShortcuts: ["global:CommandOrControl+Alt+P"],
        description: "Create and open subnote of a current day note"
    },
    {
        actionName: "DeleteNotes",
        defaultShortcuts: ["Delete"],
        description: "Delete note"
    },
    {
        actionName: "MoveNoteUp",
        defaultShortcuts: ["CommandOrControl+Up"],
        description: "Move note up"
    },
    {
        actionName: "MoveNoteDown",
        defaultShortcuts: ["CommandOrControl+Down"],
        description: "Move note down"
    },
    {
        actionName: "MoveNoteUpInHierarchy",
        defaultShortcuts: ["CommandOrControl+Left"],
        description: "Move note up in hierarchy"
    },
    {
        actionName: "MoveNoteDownInHierarchy",
        defaultShortcuts: ["CommandOrControl+Right"],
        description: "Move note down in hierarchy"
    },
    {
        actionName: "EditNoteTitle",
        defaultShortcuts: ["Enter"],
        description: "Jump from tree to the note detail and edit title"
    },
    {
        actionName: "EditBranchPrefix",
        defaultShortcuts: ["F2"],
        description: "Show Edit branch prefix dialog"
    },
    {
        actionName: "CloneNotesTo",
        defaultShortcuts: ["CommandOrControl+Shift+C"]
    },
    {
        actionName: "MoveNotesTo",
        defaultShortcuts: ["CommandOrControl+Shift+X"]
    },

    {
        separator: "Note clipboard"
    },


    {
        actionName: "CopyNotesToClipboard",
        defaultShortcuts: ["CommandOrControl+C"],
        description: "Copy selected notes to the clipboard"
    },
    {
        actionName: "PasteNotesFromClipboard",
        defaultShortcuts: ["CommandOrControl+V"],
        description: "Paste notes from the clipboard into active note"
    },
    {
        actionName: "CutNotesToClipboard",
        defaultShortcuts: ["CommandOrControl+X"],
        description: "Cut selected notes to the clipboard"
    },
    {
        actionName: "SelectAllNotesInParent",
        defaultShortcuts: ["CommandOrControl+A"],
        description: "Select all notes from the current note level"
    },
    {
        actionName: "AddNoteAboveToSelection",
        defaultShortcuts: ["Shift+Up"],
        description: "Add note above to the selection"
    },
    {
        actionName: "AddNoteBelowToSelection",
        defaultShortcuts: ["Shift+Down"],
        description: "Add note above to the selection"
    },


    {
        separator: "Tabs"
    },
    {
        actionName: "OpenNewTab",
        defaultShortcuts: isElectron ? ["CommandOrControl+T"] : [],
        description: "Opens new tab"
    },
    {
        actionName: "CloseActiveTab",
        defaultShortcuts: isElectron ? ["CommandOrControl+W"] : [],
        description: "Closes active tab"
    },
    {
        actionName: "ActivateNextTab",
        defaultShortcuts: isElectron ? ["CommandOrControl+Tab"] : [],
        description: "Activates tab on the right"
    },
    {
        actionName: "ActivatePreviousTab",
        defaultShortcuts: isElectron ? ["CommandOrControl+Shift+Tab"] : [],
        description: "Activates tab on the left"
    },


    {
        separator: "Dialogs"
    },
    {
        actionName: "ShowAttributes",
        defaultShortcuts: ["Alt+A"],
        description: "Shows Attributes dialog"
    },
    {
        actionName: "ShowNoteInfo",
        defaultShortcuts: [],
        description: "Shows Note Info dialog"
    },
    {
        actionName: "ShowNoteSource",
        defaultShortcuts: [],
        description: "Shows Note Source dialog"
    },
    {
        actionName: "ShowLinkMap",
        defaultShortcuts: [],
        description: "Shows Link Map dialog"
    },
    {
        actionName: "ShowOptions",
        defaultShortcuts: [],
        description: "Shows Options dialog"
    },
    {
        actionName: "ShowNoteRevisions",
        defaultShortcuts: [],
        description: "Shows Note Revisions dialog"
    },
    {
        actionName: "ShowRecentChanges",
        defaultShortcuts: [],
        description: "Shows Recent Changes dialog"
    },
    {
        actionName: "ShowSQLConsole",
        defaultShortcuts: ["Alt+O"],
        description: "Shows SQL Console dialog"
    },
    {
        actionName: "ShowHelp",
        defaultShortcuts: ["F1"],
        description: "Shows built-in Help / cheatsheet"
    },


    {
        separator: "Text note operations"
    },

    {
        actionName: "AddLinkToText",
        defaultShortcuts: ["CommandOrControl+L"],
        description: "Open dialog to add link to the text"
    },
    {
        actionName: "InsertDateTimeToText",
        defaultShortcuts: ["Alt+T"]
    },

    {
        separator: "Other"
    },

    {
        actionName: "PrintActiveNote",
        defaultShortcuts: []
    },
    {
        actionName: "RunActiveNote",
        defaultShortcuts: ["CommandOrControl+Enter"],
        description: "Run active JavaScript (frontend/backend) code note"
    },
    {
        actionName: "ToggleNoteHoisting",
        defaultShortcuts: ["Alt+H"],
        description: "Toggles note hoisting of active note"
    },
    {
        actionName: "ReloadFrontendApp",
        defaultShortcuts: ["F5", "CommandOrControl+R"]
    },
    {
        actionName: "OpenDevTools",
        defaultShortcuts: ["CommandOrControl+Shift+I"]
    },
    {
        actionName: "FindInText",
        defaultShortcuts: ["CommandOrControl+F"]
    },
    {
        actionName: "ToggleFullscreen",
        defaultShortcuts: ["F11"]
    },
    {
        actionName: "ToggleZenMode",
        defaultShortcuts: ["Alt+M"]
    },
    {
        actionName: "ZoomOut",
        defaultShortcuts: ["CommandOrControl+-"]
    },
    {
        actionName: "ZoomIn",
        defaultShortcuts: ["CommandOrControl+="]
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
        if (action.defaultShortcuts) {
            action.effectiveShortcuts = action.defaultShortcuts.slice();
        }
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