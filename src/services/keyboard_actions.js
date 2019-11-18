const ELECTRON = "electron";

const KEYBOARD_ACTIONS = [
    {
        optionName: "JumpToNote",
        defaultShortcuts: ["mod+j"],
        description: 'Open "Jump to note" dialog'
    },
    {
        optionName: "MarkdownToHTML",
        defaultShortcuts: ["mod+return"]
    },
    {
        optionName: "NewTab",
        defaultShortcuts: ["mod+t"],
        only: ELECTRON
    },
    {
        optionName: "CloseTab",
        defaultShortcuts: ["mod+w"],
        only: ELECTRON
    },
    {
        optionName: "NextTab",
        defaultShortcuts: ["mod+tab"],
        only: ELECTRON
    },
    {
        optionName: "PreviousTab",
        defaultShortcuts: ["mod+shift+tab"],
        only: ELECTRON
    },
    {
        optionName: "CreateNoteAfter",
        defaultShortcuts: ["mod+o"]
    },
    {
        optionName: "CreateNoteInto",
        defaultShortcuts: ["mod+p"]
    },
    {
        optionName: "ScrollToActiveNote",
        defaultShortcuts: ["mod+."]
    },
    {
        optionName: "CollapseTree",
        defaultShortcuts: ["alt+c"]
    },
    {
        optionName: "RunSQL",
        defaultShortcuts: ["mod+return"]
    },
    {
        optionName: "FocusNote",
        defaultShortcuts: ["return"]
    },
    {
        optionName: "RunCurrentNote",
        defaultShortcuts: ["mod+return"]
    },
    {
        optionName: "ClipboardCopy",
        defaultShortcuts: ["mod+c"]
    },
    {
        optionName: "ClipboardPaste",
        defaultShortcuts: ["mod+v"]
    },
    {
        optionName: "ClipboardCut",
        defaultShortcuts: ["mod+x"]
    },
    {
        optionName: "SelectAllNotesInParent",
        defaultShortcuts: ["mod+a"]
    },
    {
        optionName: "Undo",
        defaultShortcuts: ["mod+z"]
    },
    {
        optionName: "Redo",
        defaultShortcuts: ["mod+y"]
    },
    {
        optionName: "AddLinkToText",
        defaultShortcuts: ["mod+l"]
    },
    {
        optionName: "CloneNotesTo",
        defaultShortcuts: ["mod+shift+c"]
    },
    {
        optionName: "MoveNotesTo",
        defaultShortcuts: ["mod+shift+c"]
    },
    {
        optionName: "SearchNotes",
        defaultShortcuts: ["mod+s"]
    },
    {
        optionName: "ShowAttributes",
        defaultShortcuts: ["alt+a"]
    },
    {
        optionName: "ShowHelp",
        defaultShortcuts: ["f1"]
    },
    {
        optionName: "OpenSQLConsole",
        defaultShortcuts: ["alt+o"]
    },
    {
        optionName: "BackInNoteHistory",
        defaultShortcuts: ["alt+left"]
    },
    {
        optionName: "ForwardInNoteHistory",
        defaultShortcuts: ["alt+right"]
    },
    {
        optionName: "ToggleZenMode",
        defaultShortcuts: ["alt+m"]
    },
    {
        optionName: "InsertDateTime",
        defaultShortcuts: ["alt+t"]
    },
    {
        optionName: "ReloadApp",
        defaultShortcuts: ["f5", "mod+r"]
    },
    {
        optionName: "OpenDevTools",
        defaultShortcuts: ["mod+shift+i"]
    },
    {
        optionName: "FindInText",
        defaultShortcuts: ["mod+f"]
    },
    {
        optionName: "ToggleFullscreen",
        defaultShortcuts: ["f11"]
    },
    {
        optionName: "ZoomOut",
        defaultShortcuts: ["mod+-"]
    },
    {
        optionName: "ZoomIn",
        defaultShortcuts: ["mod+="]
    }
];

module.exports = {
    KEYBOARD_ACTIONS
};