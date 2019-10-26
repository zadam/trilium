import utils from "./utils.js";

const mod = utils.isMac() ? 'meta' : 'ctrl;
const defaultKeyBindings = {
    // name: default keybinding
    // TODO: Make these names self documented ie have obvious and well defined actions
    JumpToNote:          `${mod}+return`,
    MarkdownToHTML:      `${mod}+return`,
    NewTab:              `${mod}+t`,
    CloseTab:            `${mod}+w`,
    NextTab:             `${mod}+tab`,
    PrevTab:             `${mod}+shift+tab`,
    CreateChild:         `${mod}+o`,
    CreateNoteInto:      `${mod}+p`,
    ScrollToActiveNote:  `${mod}+.`,
    CollapseTree:        `alt+c`,
    RunSQL:              `${mod}+return`,
    FocusNote:           `return`,
    RunCurrentNote:      `${mod}+return`,
    Copy:                `${mod}+c`,
    Paste:               `${mod}+v`,
    Cut:                 `${mod}+x`,
    SelectAll:           `${mod}+a`,
    Undo:                `${mod}+z`,
    Redo:                `${mod}+y`,
    AddLink:             `${mod}+l`,
    Clone:               `${mod}+shift+l`,
    JumpToNote:          `${mod}+j`,
    Search:              `${mod}+s`,
    ShowAttributes:      `alt+a`,
    ShowHelp:            `f1`,
    OpenSQLConsole:      `alt+o`,
    BackHistory:         `alt+left`,
    ForwardHistory:      `alt+right`,
    ZenMode:             `alt+m`,
    InsertDateTime:      `alt+t`,
    ReloadApp:           [`f5`, `${mod}+r`],
    OpenDevTools:        `${mod}+shift+i`,
    Find:                `${mod}+f`,
    ToggleFullscreen:    `f11`,
    ZoomOut:             `${mod}+-`,
    ZoomIn:              `${mod}+=`,
};

// TODO: Load from system specific config dirs eg ~/.config/trilium/keybindings.json
const userKeyBindings = {};
const keyBindings = Object.assign({}, defaultKeyBindings, userKeyBindings);

const actions = defaultKeyBindings.keys().reduce(function(acc, field) {
    acc[field] = new Symbol(field);
    return result;
}, {})

if (utils.isElectron() && utils.isMac()) {
    const exec(cmd) => () => {
        document.execCommand(cmd);
        return false;
    }

    bind(actions.Copy, exec('copy'));
    bind(actions.Paste, exec('paste'));
    bind(actions.Cut, exec('cut'));
    bind(actions.SelectAll, exec('selectAll'));
    bind(actions.Undo, exec('undo'));
    bind(actions.Redo, exec('redo'));
}

function binTo($el, binding, handler) {
    if (!isDesktop()) return;

    let keyboardShortcuts = keyBindings[binding.description];
    if (!Array.isArray(keyboardShortcuts)) {
        keyboardShortcuts = [keyboardShortcuts];
    }

    const action = e => {
        handler(e);
        e.preventDefault();
        e.stopPropagation();
    }

    keyboardShortcuts.forEach((keyboardShortcut => {
        $el.bind('keydown', keyboardShortcut, action);
    });
}

function bind(binding, handler) {
    binTo($(document), binding, handler);
}

export default {
    actions,
    bindTo,
    bind,
}
