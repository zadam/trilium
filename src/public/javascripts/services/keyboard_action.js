/**
 * blaa vlaa
 */
class KeyboardAction {
    constructor(params) {
    	/** @property {string} */
        this.optionName = params.optionName;
		/** @property {string[]} */
        this.defaultShortcuts = Array.isArray(params.defaultShortcuts) ? params.defaultShortcuts : [params.defaultShortcuts];
        /** @property {string[]} */
        this.activeShortcuts = this.defaultShortcuts.slice();
        /** @property {string} */
        this.description = params.description;
    }

    addShortcut(shortcut) {
    	this.activeShortcuts.push(shortcut);
	}

	/**
	 * @param {string|string[]} shortcuts
	 */
	replaceShortcuts(shortcuts) {
    	this.activeShortcuts = Array.isArray(shortcuts) ? shortcuts : [shortcuts];
	}

	/** @return {KeyboardAction[]} */
	static get allActions() {
    	return Object.keys(KeyboardAction)
			.map(key => KeyboardAction[key])
			.filter(obj => obj instanceof KeyboardAction);
	}
}

const ELECTRON = 1;

/**
 * Open "Jump to note" dialog
 * @static
 */
KeyboardAction.JumpToNote = new KeyboardAction({
	optionName: "JumpToNote",
	defaultShortcuts: "mod+j",
	description: 'Open "Jump to note" dialog'
});

/** @static */
KeyboardAction.MarkdownToHTML = new KeyboardAction({
	optionName: "MarkdownToHTML",
	defaultShortcuts: "mod+return"
});

/** @static */
KeyboardAction.NewTab = new KeyboardAction({
	optionName: "NewTab",
	defaultShortcuts: "mod+t",
	only: ELECTRON
});

/** @static */
KeyboardAction.CloseTab = new KeyboardAction({
	optionName: "CloseTab",
	defaultShortcuts: "mod+w",
	only: ELECTRON
});

/** @static */
KeyboardAction.NextTab = new KeyboardAction({
	optionName: "NextTab",
	defaultShortcuts: "mod+tab",
	only: ELECTRON
});

/** @static */
KeyboardAction.PreviousTab = new KeyboardAction({
	optionName: "PreviousTab",
	defaultShortcuts: "mod+shift+tab",
	only: ELECTRON
});

/** @static */
KeyboardAction.CreateNoteAfter = new KeyboardAction({
	optionName: "CreateNoteAfter",
	defaultShortcuts: "mod+o"
});

/** @static */
KeyboardAction.CreateNoteInto = new KeyboardAction({
	optionName: "CreateNoteInto",
	defaultShortcuts: "mod+p"
});

/** @static */
KeyboardAction.ScrollToActiveNote = new KeyboardAction({
	optionName: "ScrollToActiveNote",
	defaultShortcuts: "mod+."
});

/** @static */
KeyboardAction.CollapseTree = new KeyboardAction({
	optionName: "CollapseTree",
	defaultShortcuts: "alt+c"
});

/** @static */
KeyboardAction.RunSQL = new KeyboardAction({
	optionName: "RunSQL",
	defaultShortcuts: "mod+return"
});

/** @static */
KeyboardAction.FocusNote = new KeyboardAction({
	optionName: "FocusNote",
	defaultShortcuts: "return"
});

/** @static */
KeyboardAction.RunCurrentNote = new KeyboardAction({
	optionName: "RunCurrentNote",
	defaultShortcuts: "mod+return"
});

/** @static */
KeyboardAction.ClipboardCopy = new KeyboardAction({
	optionName: "ClipboardCopy",
	defaultShortcuts: "mod+c"
});

/** @static */
KeyboardAction.ClipboardPaste = new KeyboardAction({
	optionName: "ClipboardPaste",
	defaultShortcuts: "mod+v"
});

/** @static */
KeyboardAction.ClipboardCut = new KeyboardAction({
	optionName: "ClipboardCut",
	defaultShortcuts: "mod+x"
});

/** @static */
KeyboardAction.SelectAllNotesInParent = new KeyboardAction({
	optionName: "SelectAllNotesInParent",
	defaultShortcuts: "mod+a"
});

/** @static */
KeyboardAction.Undo = new KeyboardAction({
	optionName: "Undo",
	defaultShortcuts: "mod+z"
});

/** @static */
KeyboardAction.Redo = new KeyboardAction({
	optionName: "Redo",
	defaultShortcuts: "mod+y"
});

/** @static */
KeyboardAction.AddLinkToText = new KeyboardAction({
	optionName: "AddLinkToText",
	defaultShortcuts: "mod+l"
});

/** @static */
KeyboardAction.CloneNotesTo = new KeyboardAction({
	optionName: "CloneNotesTo",
	defaultShortcuts: "mod+shift+c"
});

/** @static */
KeyboardAction.MoveNotesTo = new KeyboardAction({
	optionName: "MoveNotesTo",
	defaultShortcuts: "mod+shift+c"
});

/** @static */
KeyboardAction.SearchNotes = new KeyboardAction({
	optionName: "SearchNotes",
	defaultShortcuts: "mod+s"
});

/** @static */
KeyboardAction.ShowAttributes = new KeyboardAction({
	optionName: "ShowAttributes",
	defaultShortcuts: "alt+a"
});

/** @static */
KeyboardAction.ShowHelp = new KeyboardAction({
	optionName: "ShowHelp",
	defaultShortcuts: "f1"
});

/** @static */
KeyboardAction.OpenSQLConsole = new KeyboardAction({
	optionName: "OpenSQLConsole",
	defaultShortcuts: "alt+o"
});

/** @static */
KeyboardAction.BackInNoteHistory = new KeyboardAction({
	optionName: "BackInNoteHistory",
	defaultShortcuts: "alt+left"
});

/** @static */
KeyboardAction.ForwardInNoteHistory = new KeyboardAction({
	optionName: "ForwardInNoteHistory",
	defaultShortcuts: "alt+right"
});

/** @static */
KeyboardAction.ToggleZenMode = new KeyboardAction({
	optionName: "ToggleZenMode",
	defaultShortcuts: "alt+m"
});

/** @static */
KeyboardAction.InsertDateTime = new KeyboardAction({
	optionName: "InsertDateTime",
	defaultShortcuts: "alt+t"
});

/** @static */
KeyboardAction.ReloadApp = new KeyboardAction({
    optionName: "ReloadApp",
    defaultShortcuts: ["f5", "mod+r"]
});

/** @static */
KeyboardAction.OpenDevTools = new KeyboardAction({
	optionName: "OpenDevTools",
	defaultShortcuts: "mod+shift+i"
});

/** @static */
KeyboardAction.FindInText = new KeyboardAction({
	optionName: "FindInText",
	defaultShortcuts: "mod+f"
});

/** @static */
KeyboardAction.ToggleFullscreen = new KeyboardAction({
	optionName: "ToggleFullscreen",
	defaultShortcuts: "f11"
});

/** @static */
KeyboardAction.ZoomOut = new KeyboardAction({
	optionName: "ZoomOut",
	defaultShortcuts: "mod+-"
});

/** @static */
KeyboardAction.ZoomIn = new KeyboardAction({
	optionName: "ZoomIn",
	defaultShortcuts: "mod+="
});

export default KeyboardAction;