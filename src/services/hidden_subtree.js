const becca = require("../becca/becca");
const noteService = require("./notes");
const log = require("./log");

const LBTPL_ROOT = "lbTplRoot";
const LBTPL_BASE = "lbTplBase";
const LBTPL_COMMAND = "lbTplCommand";
const LBTPL_NOTE_LAUNCHER = "lbTplNoteLauncher";
const LBTPL_SCRIPT = "lbTplScript";
const LBTPL_BUILTIN_WIDGET = "lbTplBuiltinWidget";
const LBTPL_SPACER = "lbTplSpacer";
const LBTPL_CUSTOM_WIDGET = "lbTplCustomWidget";

const HIDDEN_SUBTREE_DEFINITION = {
    id: 'hidden',
    title: 'hidden',
    type: 'doc',
    icon: 'bx bx-chip',
    // we want to keep the hidden subtree always last, otherwise there will be problems with e.g. keyboard navigation
    // over tree when it's in the middle
    notePosition: 999_999_999,
    attributes: [
        // isInheritable: false means that this notePath is automatically not preffered but at the same time
        // the flag is not inherited to the children
        { type: 'label', name: 'archived' },
        { type: 'label', name: 'excludeFromNoteMap', isInheritable: true }
    ],
    children: [
        {
            id: 'search',
            title: 'search',
            type: 'doc'
        },
        {
            id: 'globalNoteMap',
            title: 'Note Map',
            type: 'noteMap',
            attributes: [
                { type: 'label', name: 'mapRootId', value: 'hoisted' }
            ]
        },
        {
            id: 'sqlConsole',
            title: 'SQL Console',
            type: 'doc',
            icon: 'bx-data'
        },
        {
            id: 'share',
            title: 'Shared Notes',
            type: 'doc',
            attributes: [ { type: 'label', name: 'docName', value: 'share' } ]
        },
        {
            id: 'bulkAction',
            title: 'Bulk action',
            type: 'doc',
        },
        {
            id: LBTPL_ROOT,
            title: 'Launch Bar Templates',
            type: 'doc',
            children: [
                {
                    id: LBTPL_BASE,
                    title: 'Base Abstract Launcher',
                    type: 'doc'
                },
                {
                    id: LBTPL_COMMAND,
                    title: 'Command Launcher',
                    type: 'doc',
                    attributes: [
                        { type: 'relation', name: 'template', value: LBTPL_BASE },
                        { type: 'label', name: 'launcherType', value: 'command' },
                        { type: 'label', name: 'docName', value: 'launchbar_command_launcher' }
                    ]
                },
                {
                    id: LBTPL_NOTE_LAUNCHER,
                    title: 'Note Launcher',
                    type: 'doc',
                    attributes: [
                        { type: 'relation', name: 'template', value: LBTPL_BASE },
                        { type: 'label', name: 'launcherType', value: 'note' },
                        { type: 'label', name: 'relation:targetNote', value: 'promoted' },
                        { type: 'label', name: 'label:keyboardShortcut', value: 'promoted,text' },
                        { type: 'label', name: 'docName', value: 'launchbar_note_launcher' }
                    ]
                },
                {
                    id: LBTPL_SCRIPT,
                    title: 'Script Launcher',
                    type: 'doc',
                    attributes: [
                        { type: 'relation', name: 'template', value: LBTPL_BASE },
                        { type: 'label', name: 'launcherType', value: 'script' },
                        { type: 'label', name: 'relation:script', value: 'promoted' },
                        { type: 'label', name: 'label:keyboardShortcut', value: 'promoted,text' },
                        { type: 'label', name: 'docName', value: 'launchbar_script_launcher' }
                    ]
                },
                {
                    id: LBTPL_BUILTIN_WIDGET,
                    title: 'Built-in Widget',
                    type: 'doc',
                    attributes: [
                        { type: 'relation', name: 'template', value: LBTPL_BASE },
                        { type: 'label', name: 'launcherType', value: 'builtinWidget' }
                    ]
                },
                {
                    id: LBTPL_SPACER,
                    title: 'Spacer',
                    type: 'doc',
                    icon: 'bx-move-vertical',
                    attributes: [
                        { type: 'relation', name: 'template', value: LBTPL_BUILTIN_WIDGET },
                        { type: 'label', name: 'builtinWidget', value: 'spacer' },
                        { type: 'label', name: 'label:baseSize', value: 'promoted,number' },
                        { type: 'label', name: 'label:growthFactor', value: 'promoted,number' },
                        { type: 'label', name: 'docName', value: 'launchbar_spacer' }
                    ]
                },
                {
                    id: LBTPL_CUSTOM_WIDGET,
                    title: 'Custom Widget',
                    type: 'doc',
                    attributes: [
                        { type: 'relation', name: 'template', value: LBTPL_BASE },
                        { type: 'label', name: 'launcherType', value: 'customWidget' },
                        { type: 'label', name: 'relation:widget', value: 'promoted' },
                        { type: 'label', name: 'docName', value: 'launchbar_widget_launcher' }
                    ]
                },
            ]
        },
        {
            id: 'lbRoot',
            title: 'Launch bar',
            type: 'doc',
            icon: 'bx-sidebar',
            isExpanded: true,
            attributes: [ { type: 'label', name: 'docName', value: 'launchbar_intro' } ],
            children: [
                {
                    id: 'lbAvailableLaunchers',
                    title: 'Available Launchers',
                    type: 'doc',
                    icon: 'bx-hide',
                    isExpanded: true,
                    attributes: [ { type: 'label', name: 'docName', value: 'launchbar_intro' } ],
                    children: [
                        { id: 'lbBackInHistory', title: 'Back in history', type: 'launcher', builtinWidget: 'backInHistoryButton', icon: 'bx bxs-left-arrow-square' },
                        { id: 'lbForwardInHistory', title: 'Forward in history', type: 'launcher', builtinWidget: 'forwardInHistoryButton', icon: 'bx bxs-right-arrow-square' },
                    ]
                },
                {
                    id: 'lbVisibleLaunchers',
                    title: 'Visible Launchers',
                    type: 'doc',
                    icon: 'bx-show',
                    isExpanded: true,
                    attributes: [ { type: 'label', name: 'docName', value: 'launchbar_intro' } ],
                    children: [
                        { id: 'lbNewNote', title: 'New Note', type: 'launcher', command: 'createNoteIntoInbox', icon: 'bx bx-file-blank' },
                        { id: 'lbSearch', title: 'Search Notes', type: 'launcher', command: 'searchNotes', icon: 'bx bx-search' },
                        { id: 'lbJumpTo', title: 'Jump to Note', type: 'launcher', command: 'jumpToNote', icon: 'bx bx-send' },
                        { id: 'lbNoteMap', title: 'Note Map', type: 'launcher', targetNoteId: 'globalNoteMap', icon: 'bx bx-map-alt' },
                        { id: 'lbCalendar', title: 'Calendar', type: 'launcher', builtinWidget: 'calendar', icon: 'bx bx-calendar' },
                        { id: 'lbRecentChanges', title: 'Recent Changes', type: 'launcher', command: 'showRecentChanges', icon: 'bx bx-history' },
                        { id: 'lbSpacer1', title: 'Spacer', type: 'launcher', builtinWidget: 'spacer', baseSize: "50", growthFactor: "0" },
                        { id: 'lbBookmarks', title: 'Bookmarks', type: 'launcher', builtinWidget: 'bookmarks', icon: 'bx bx-bookmark' },
                        { id: 'lbSpacer2', title: 'Spacer', type: 'launcher', builtinWidget: 'spacer', baseSize: "0", growthFactor: "1" },
                        { id: 'lbProtectedSession', title: 'Protected Session', type: 'launcher', builtinWidget: 'protectedSession', icon: 'bx bx bx-shield-quarter' },
                        { id: 'lbSyncStatus', title: 'Sync Status', type: 'launcher', builtinWidget: 'syncStatus', icon: 'bx bx-wifi' }
                    ]
                }
            ]
        },
        {
            id: 'options',
            title: 'Options',
            type: 'book',
            children: [
                { id: 'optionsAppearance', title: 'Appearance', type: 'contentWidget', icon: 'bx-layout' },
                { id: 'optionsShortcuts', title: 'Shortcuts', type: 'contentWidget', icon: 'bxs-keyboard' },
                { id: 'optionsTextNotes', title: 'Text Notes', type: 'contentWidget', icon: 'bx-text' },
                { id: 'optionsCodeNotes', title: 'Code Notes', type: 'contentWidget', icon: 'bx-code' },
                { id: 'optionsImages', title: 'Images', type: 'contentWidget', icon: 'bx-image' },
                { id: 'optionsSpellcheck', title: 'Spellcheck', type: 'contentWidget', icon: 'bx-check-double' },
                { id: 'optionsPassword', title: 'Password', type: 'contentWidget', icon: 'bx-lock' },
                { id: 'optionsEtapi', title: 'ETAPI', type: 'contentWidget', icon: 'bx-extension' },
                { id: 'optionsBackup', title: 'Backup', type: 'contentWidget', icon: 'bx-data' },
                { id: 'optionsSync', title: 'Sync', type: 'contentWidget', icon: 'bx-wifi' },
                { id: 'optionsOther', title: 'Other', type: 'contentWidget', icon: 'bx-dots-horizontal' },
                { id: 'optionsAdvanced', title: 'Advanced', type: 'contentWidget' }
            ]
        }
    ]
};

function checkHiddenSubtree() {
    checkHiddenSubtreeRecursively('root', HIDDEN_SUBTREE_DEFINITION);
}

function checkHiddenSubtreeRecursively(parentNoteId, item) {
    if (!item.id || !item.type || !item.title) {
        throw new Error(`Item does not contain mandatory properties: ` + JSON.stringify(item));
    }

    let note = becca.notes[item.id];
    let branch = becca.branches[item.id];

    const attrs = [...(item.attributes || [])];

    if (item.icon) {
        attrs.push({ type: 'label', name: 'iconClass', value: 'bx ' + item.icon });
    }

    if (!note) {
        ({note, branch} = noteService.createNewNote({
            branchId: item.id,
            noteId: item.id,
            title: item.title,
            type: item.type,
            parentNoteId: parentNoteId,
            content: '',
            ignoreForbiddenParents: true
        }));

        if (item.type === 'launcher') {
            if (item.command) {
                attrs.push({ type: 'relation', name: 'template', value: LBTPL_COMMAND });
                attrs.push({ type: 'label', name: 'command', value: item.command });
            } else if (item.builtinWidget) {
                if (item.builtinWidget === 'spacer') {
                    attrs.push({ type: 'relation', name: 'template', value: LBTPL_SPACER });
                    attrs.push({ type: 'label', name: 'baseSize', value: item.baseSize });
                    attrs.push({ type: 'label', name: 'growthFactor', value: item.growthFactor });
                } else {
                    attrs.push({ type: 'relation', name: 'template', value: LBTPL_BUILTIN_WIDGET });
                }

                attrs.push({ type: 'label', name: 'builtinWidget', value: item.builtinWidget });
             } else if (item.targetNoteId) {
                attrs.push({ type: 'relation', name: 'template', value: LBTPL_NOTE_LAUNCHER });
                attrs.push({ type: 'relation', name: 'targetNote', value: item.targetNoteId });
            } else {
                throw new Error(`No action defined for launcher ${JSON.stringify(item)}`);
            }
        }
    }

    if (note.type !== item.type) {
        // enforce correct note type
        note.type = item.type;
        note.save();
    }

    if (!branch) {
        // not sure if there's some better way to recover
        log.error(`Cannot find branch id='${item.id}', ignoring...`);
    } else {
        if (item.notePosition !== undefined && branch.notePosition !== item.notePosition) {
            branch.notePosition = item.notePosition;
            branch.save();
        }

        if (item.isExpanded !== undefined && branch.isExpanded !== item.isExpanded) {
            branch.isExpanded = item.isExpanded;
            branch.save();
        }
    }

    for (const attr of attrs) {
        if (!note.hasAttribute(attr.type, attr.name)) {
            note.addAttribute(attr.type, attr.name, attr.value);
        }
    }

    for (const child of item.children || []) {
        checkHiddenSubtreeRecursively(item.id, child);
    }
}

module.exports = {
    checkHiddenSubtree
};
