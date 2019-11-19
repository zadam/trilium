"use strict";

const optionService = require('./options');
const utils = require('./utils');
const log = require('./log');

const ELECTRON = "electron";

const DEFAULT_KEYBOARD_ACTIONS = [
    {
        actionName: "JumpToNote",
        defaultShortcuts: ["mod+j"],
        description: 'Open "Jump to note" dialog'
    },
    {
        actionName: "MarkdownToHTML",
        defaultShortcuts: ["mod+return"]
    },
    {
        actionName: "NewTab",
        defaultShortcuts: ["mod+t"],
        only: ELECTRON
    },
    {
        actionName: "CloseTab",
        defaultShortcuts: ["mod+w"],
        only: ELECTRON
    },
    {
        actionName: "NextTab",
        defaultShortcuts: ["mod+tab"],
        only: ELECTRON
    },
    {
        actionName: "PreviousTab",
        defaultShortcuts: ["mod+shift+tab"],
        only: ELECTRON
    },
    {
        actionName: "CreateNoteAfter",
        defaultShortcuts: ["mod+o"]
    },
    {
        actionName: "CreateNoteInto",
        defaultShortcuts: ["mod+p"]
    },
    {
        actionName: "ScrollToActiveNote",
        defaultShortcuts: ["mod+."]
    },
    {
        actionName: "CollapseTree",
        defaultShortcuts: ["alt+c"]
    },
    {
        actionName: "RunSQL",
        defaultShortcuts: ["mod+return"]
    },
    {
        actionName: "FocusNote",
        defaultShortcuts: ["return"]
    },
    {
        actionName: "RunCurrentNote",
        defaultShortcuts: ["mod+return"]
    },
    {
        actionName: "ClipboardCopy",
        defaultShortcuts: ["mod+c"]
    },
    {
        actionName: "ClipboardPaste",
        defaultShortcuts: ["mod+v"]
    },
    {
        actionName: "ClipboardCut",
        defaultShortcuts: ["mod+x"]
    },
    {
        actionName: "SelectAllNotesInParent",
        defaultShortcuts: ["mod+a"]
    },
    {
        actionName: "Undo",
        defaultShortcuts: ["mod+z"]
    },
    {
        actionName: "Redo",
        defaultShortcuts: ["mod+y"]
    },
    {
        actionName: "AddLinkToText",
        defaultShortcuts: ["mod+l"]
    },
    {
        actionName: "CloneNotesTo",
        defaultShortcuts: ["mod+shift+c"]
    },
    {
        actionName: "MoveNotesTo",
        defaultShortcuts: ["mod+shift+c"]
    },
    {
        actionName: "SearchNotes",
        defaultShortcuts: ["mod+s"]
    },
    {
        actionName: "ShowAttributes",
        defaultShortcuts: ["alt+a"]
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
        defaultShortcuts: ["f1"]
    },
    {
        actionName: "ShowSQLConsole",
        defaultShortcuts: ["alt+o"]
    },
    {
        actionName: "BackInNoteHistory",
        defaultShortcuts: ["alt+left"]
    },
    {
        actionName: "ForwardInNoteHistory",
        defaultShortcuts: ["alt+right"]
    },
    {
        actionName: "ToggleZenMode",
        defaultShortcuts: ["alt+m"]
    },
    {
        actionName: "InsertDateTime",
        defaultShortcuts: ["alt+t"]
    },
    {
        actionName: "ReloadApp",
        defaultShortcuts: ["f5", "mod+r"]
    },
    {
        actionName: "OpenDevTools",
        defaultShortcuts: ["mod+shift+i"]
    },
    {
        actionName: "FindInText",
        defaultShortcuts: ["mod+f"]
    },
    {
        actionName: "ToggleFullscreen",
        defaultShortcuts: ["f11"]
    },
    {
        actionName: "ZoomOut",
        defaultShortcuts: ["mod+-"]
    },
    {
        actionName: "ZoomIn",
        defaultShortcuts: ["mod+="]
    }
];

if (process.platform === "darwin") {
    // Mac has a different history navigation shortcuts - https://github.com/zadam/trilium/issues/376
    DEFAULT_KEYBOARD_ACTIONS.find(ka => ka.actionName === 'BackInNoteHistory').defaultShortcuts = ["meta+left"];
    DEFAULT_KEYBOARD_ACTIONS.find(ka => ka.actionName === 'ForwardInNoteHistory').defaultShortcuts = ["meta+right"];
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