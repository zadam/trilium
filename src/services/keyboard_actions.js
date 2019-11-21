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
        actionName: "ClipboardCopy",
        defaultShortcuts: ["CommandOrControl+C"],
        description: "Copy selected notes to the clipboard"
    },
    {
        actionName: "ClipboardPaste",
        defaultShortcuts: ["CommandOrControl+V"],
        description: "Paste notes from the clipboard into active note"
    },
    {
        actionName: "ClipboardCut",
        defaultShortcuts: ["CommandOrControl+X"],
        description: "Copy selected notes to the clipboard"
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
        actionName: "Undo",
        defaultShortcuts: ["CommandOrControl+Z"],
        description: "Undo last text operation (applicable on MacOS only)"
    },
    {
        actionName: "Redo",
        defaultShortcuts: ["CommandOrControl+Y"],
        description: "Undo last text operation (applicable on MacOS only)"
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