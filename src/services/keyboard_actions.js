"use strict";

const optionService = require('./options');
const log = require('./log');

const ELECTRON = "electron";

const DEFAULT_KEYBOARD_ACTIONS = [
    {
        separator: "Note navigation"
    },
    {
        actionName: "BackInNoteHistory",
        defaultShortcuts: ["Alt+Left"]
    },
    {
        actionName: "ForwardInNoteHistory",
        defaultShortcuts: ["Alt+Right"]
    },
    {
        actionName: "JumpToNote",
        defaultShortcuts: ["CommandOrControl+J"],
        description: 'Open "Jump to note" dialog'
    },


    {
        separator: "Tabs"
    },
    {
        actionName: "NewTab",
        defaultShortcuts: ["CommandOrControl+T"],
        only: ELECTRON
    },
    {
        actionName: "CloseTab",
        defaultShortcuts: ["CommandOrControl+W"],
        only: ELECTRON
    },
    {
        actionName: "NextTab",
        defaultShortcuts: ["CommandOrControl+Tab"],
        only: ELECTRON
    },
    {
        actionName: "PreviousTab",
        defaultShortcuts: ["CommandOrControl+Shift+Tab"],
        only: ELECTRON
    },


    {
        separator: "Dialogs"
    },
    {
        actionName: "ShowAttributes",
        defaultShortcuts: ["Alt+A"]
    },
    {
        actionName: "ShowNoteInfo",
        defaultShortcuts: []
    },
    {
        actionName: "ShowNoteSource",
        defaultShortcuts: []
    },
    {
        actionName: "ShowLinkMap",
        defaultShortcuts: []
    },
    {
        actionName: "ShowOptions",
        defaultShortcuts: []
    },
    {
        actionName: "ShowNoteRevisions",
        defaultShortcuts: []
    },
    {
        actionName: "ShowRecentChanges",
        defaultShortcuts: []
    },
    {
        actionName: "ShowHelp",
        defaultShortcuts: ["F1"]
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
        actionName: "ScrollToActiveNote",
        defaultShortcuts: ["CommandOrControl+."]
    },
    {
        actionName: "CollapseTree",
        defaultShortcuts: ["Alt+C"]
    },
    {
        actionName: "FocusNote",
        defaultShortcuts: ["return"]
    },
    {
        actionName: "RunCurrentNote",
        defaultShortcuts: ["CommandOrControl+return"]
    },
    {
        actionName: "DeleteNote",
        defaultShortcuts: ["Delete"],
        description: "Delete note"
    },
    {
        actionName: "MoveNoteUp",
        defaultShortcuts: ["Ctrl+Up"],
        description: "Move note up"
    },
    {
        actionName: "MoveNoteDown",
        defaultShortcuts: ["Ctrl+Down"],
        description: "Move note down"
    },
    {
        actionName: "MoveNoteUpInHierarchy",
        defaultShortcuts: ["Ctrl+Left"],
        description: "Move note up in hierarchy"
    },
    {
        actionName: "MoveNoteDownInHierarchy",
        defaultShortcuts: ["Ctrl+Right"],
        description: "Move note down in hierarchy"
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
        actionName: "EditBranchPrefix",
        defaultShortcuts: ["F2"],
        description: "Show Edit branch prefix dialog"
    },
    {
        actionName: "CollapseSubtree",
        defaultShortcuts: ["Alt+-"],
        description: "Collapses subtree of current note"
    },
    {
        actionName: "SortChildNotes",
        defaultShortcuts: ["Alt+s"],
        description: "Sort child notes"
    },
    {
        actionName: "ActivateParentNote",
        defaultShortcuts: ["Backspace"],
        description: "Activates parent note of currently active note"
    },
    {
        actionName: "ToggleNoteHoisting",
        defaultShortcuts: ["Alt+h"],
        description: "Toggles note hoisting of active note"
    },
    {
        actionName: "SearchInSubtree",
        defaultShortcuts: ["CommandOrControl+Shift+S"],
        description: "Search for notes in the active note's subtree"
    },
    {
        actionName: "EditNoteTitle",
        defaultShortcuts: ["return"],
        description: "Edit active note title"
    },
    {
        actionName: "SelectAllNotesInParent",
        defaultShortcuts: ["CommandOrControl+A"],
        description: "Select all notes from the current note level"
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
        actionName: "CloneNotesTo",
        defaultShortcuts: ["CommandOrControl+Shift+C"]
    },
    {
        actionName: "MoveNotesTo",
        defaultShortcuts: ["CommandOrControl+Shift+C"]
    },
    {
        actionName: "SearchNotes",
        defaultShortcuts: ["CommandOrControl+S"]
    },
    {
        actionName: "ShowSQLConsole",
        defaultShortcuts: ["Alt+O"]
    },
    {
        actionName: "RunSQL",
        defaultShortcuts: ["CommandOrControl+return"]
    },
    {
        actionName: "InsertDateTime",
        defaultShortcuts: ["Alt+T"]
    },
    {
        actionName: "ReloadApp",
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
    },
    {
        actionName: "MarkdownToHTML",
        defaultShortcuts: ["CommandOrControl+Return"]
    },
];

if (process.platform === "darwin") {
    for (const action of DEFAULT_KEYBOARD_ACTIONS) {
        if (action.defaultShortcuts) {
            action.defaultShortcuts = action.defaultShortcuts.map(shortcut => shortcut.replace("CommandOrControl", "Meta"));
        }
    }

    // Mac has a different history navigation shortcuts - https://github.com/zadam/trilium/issues/376
    DEFAULT_KEYBOARD_ACTIONS.find(ka => ka.actionName === 'BackInNoteHistory').defaultShortcuts = ["Meta+Left"];
    DEFAULT_KEYBOARD_ACTIONS.find(ka => ka.actionName === 'ForwardInNoteHistory').defaultShortcuts = ["Meta+Right"];
}
else {
    for (const action of DEFAULT_KEYBOARD_ACTIONS) {
        if (action.defaultShortcuts) {
            action.defaultShortcuts = action.defaultShortcuts.map(shortcut => shortcut.replace("CommandOrControl", "Ctrl"));
        }
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
                log.info(`Keyboard action ${actionName} not found.`);
            }
        }
    }

    return actions;
}

module.exports = {
    DEFAULT_KEYBOARD_ACTIONS,
    getKeyboardActions
};