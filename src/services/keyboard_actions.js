"use strict";

const optionService = require('./options');
const log = require('./log');

const ELECTRON = "electron";

const DEFAULT_KEYBOARD_ACTIONS = [
    {
        actionName: "JumpToNote",
        defaultShortcuts: ["Mod+J"],
        description: 'Open "Jump to note" dialog'
    },
    {
        actionName: "MarkdownToHTML",
        defaultShortcuts: ["Mod+Return"]
    },
    {
        actionName: "NewTab",
        defaultShortcuts: ["Mod+T"],
        only: ELECTRON
    },
    {
        actionName: "CloseTab",
        defaultShortcuts: ["Mod+W"],
        only: ELECTRON
    },
    {
        actionName: "NextTab",
        defaultShortcuts: ["Mod+Tab"],
        only: ELECTRON
    },
    {
        actionName: "PreviousTab",
        defaultShortcuts: ["Mod+SHIFT+Tab"],
        only: ELECTRON
    },
    {
        actionName: "CreateNoteAfter",
        defaultShortcuts: ["Mod+O"]
    },
    {
        actionName: "CreateNoteInto",
        defaultShortcuts: ["Mod+P"]
    },
    {
        actionName: "ScrollToActiveNote",
        defaultShortcuts: ["Mod+."]
    },
    {
        actionName: "CollapseTree",
        defaultShortcuts: ["Alt+C"]
    },
    {
        actionName: "RunSQL",
        defaultShortcuts: ["Mod+return"]
    },
    {
        actionName: "FocusNote",
        defaultShortcuts: ["return"]
    },
    {
        actionName: "RunCurrentNote",
        defaultShortcuts: ["Mod+return"]
    },
    {
        actionName: "ClipboardCopy",
        defaultShortcuts: ["Mod+C"]
    },
    {
        actionName: "ClipboardPaste",
        defaultShortcuts: ["Mod+V"]
    },
    {
        actionName: "ClipboardCut",
        defaultShortcuts: ["Mod+X"]
    },
    {
        actionName: "SelectAllNotesInParent",
        defaultShortcuts: ["Mod+A"]
    },
    {
        actionName: "Undo",
        defaultShortcuts: ["Mod+Z"]
    },
    {
        actionName: "Redo",
        defaultShortcuts: ["Mod+Y"]
    },
    {
        actionName: "AddLinkToText",
        defaultShortcuts: ["Mod+L"]
    },
    {
        actionName: "CloneNotesTo",
        defaultShortcuts: ["Mod+Shift+C"]
    },
    {
        actionName: "MoveNotesTo",
        defaultShortcuts: ["Mod+Shift+C"]
    },
    {
        actionName: "SearchNotes",
        defaultShortcuts: ["Mod+S"]
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
        actionName: "ShowSQLConsole",
        defaultShortcuts: ["Alt+O"]
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
        actionName: "ToggleZenMode",
        defaultShortcuts: ["Alt+M"]
    },
    {
        actionName: "InsertDateTime",
        defaultShortcuts: ["Alt+T"]
    },
    {
        actionName: "ReloadApp",
        defaultShortcuts: ["F5", "Mod+R"]
    },
    {
        actionName: "OpenDevTools",
        defaultShortcuts: ["Mod+SHIFT+I"]
    },
    {
        actionName: "FindInText",
        defaultShortcuts: ["Mod+F"]
    },
    {
        actionName: "ToggleFullscreen",
        defaultShortcuts: ["F11"]
    },
    {
        actionName: "ZoomOut",
        defaultShortcuts: ["Mod+-"]
    },
    {
        actionName: "ZoomIn",
        defaultShortcuts: ["Mod+="]
    }
];

if (process.platform === "darwin") {
    for (const action of DEFAULT_KEYBOARD_ACTIONS) {
        action.defaultShortcuts = action.defaultShortcuts.map(shortcut => shortcut.replace("Mod", "Meta"));
    }

    // Mac has a different history navigation shortcuts - https://github.com/zadam/trilium/issues/376
    DEFAULT_KEYBOARD_ACTIONS.find(ka => ka.actionName === 'BackInNoteHistory').defaultShortcuts = ["Meta+Left"];
    DEFAULT_KEYBOARD_ACTIONS.find(ka => ka.actionName === 'ForwardInNoteHistory').defaultShortcuts = ["Meta+Right"];
}
else {
    for (const action of DEFAULT_KEYBOARD_ACTIONS) {
        action.defaultShortcuts = action.defaultShortcuts.map(shortcut => shortcut.replace("Mod", "Ctrl"));
    }
}

async function getKeyboardActions() {
    const actions = JSON.parse(JSON.stringify(DEFAULT_KEYBOARD_ACTIONS));

    for (const action of actions) {
        action.effectiveShortcuts = action.defaultShortcuts.slice();
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