const becca = require("../becca/becca");
const noteService = require("./notes");
const Attribute = require("../becca/entities/attribute.js");
const log = require("./log");
const migrationService = require("./migration");

const LBTPL_ROOT = "_lbTplRoot";
const LBTPL_BASE = "_lbTplBase";
const LBTPL_COMMAND = "_lbTplCommandLauncher";
const LBTPL_NOTE_LAUNCHER = "_lbTplNoteLauncher";
const LBTPL_SCRIPT = "_lbTplScriptLauncher";
const LBTPL_BUILTIN_WIDGET = "_lbTplBuiltinWidget";
const LBTPL_SPACER = "_lbTplSpacer";
const LBTPL_CUSTOM_WIDGET = "_lbTplCustomWidget";

/*
 * Hidden subtree is generated as a "predictable structure" which means that it avoids generating random IDs to always
 * produce same structure. This is needed because it is run on multiple instances in the sync cluster which might produce
 * duplicate subtrees. This way, all instances will generate the same structure with same IDs.
 */

const HIDDEN_SUBTREE_DEFINITION = {
    id: '_hidden',
    title: 'Hidden Notes',
    type: 'doc',
    icon: 'bx bx-chip',
    // we want to keep the hidden subtree always last, otherwise there will be problems with e.g. keyboard navigation
    // over tree when it's in the middle
    notePosition: 999_999_999,
    attributes: [
        { type: 'label', name: 'excludeFromNoteMap', isInheritable: true },
        { type: 'label', name: 'docName', value: 'hidden' }
    ],
    children: [
        {
            id: '_search',
            title: 'Search History',
            type: 'doc'
        },
        {
            id: '_globalNoteMap',
            title: 'Note Map',
            type: 'noteMap',
            attributes: [
                { type: 'label', name: 'mapRootNoteId', value: 'hoisted' },
                { type: 'label', name: 'keepCurrentHoisting' }
            ]
        },
        {
            id: '_sqlConsole',
            title: 'SQL Console History',
            type: 'doc',
            icon: 'bx-data'
        },
        {
            id: '_share',
            title: 'Shared Notes',
            type: 'doc',
            attributes: [ { type: 'label', name: 'docName', value: 'share' } ]
        },
        {
            id: '_bulkAction',
            title: 'Bulk Action',
            type: 'doc',
        },
        {
            id: '_backendLog',
            title: 'Backend Log',
            type: 'contentWidget',
            icon: 'bx-terminal',
            attributes: [
                { type: 'label', name: 'keepCurrentHoisting' }
            ]
        },
        {
            // place for user scripts hidden stuff (scripts should not create notes directly under hidden root)
            id: '_userHidden',
            title: 'User Hidden',
            type: 'doc',
            attributes: [ { type: 'label', name: 'docName', value: 'user_hidden' } ]
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
                        { type: 'label', name: 'relation:target', value: 'promoted' },
                        { type: 'label', name: 'relation:hoistedNote', value: 'promoted' },
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
            id: '_lbRoot',
            title: 'Launch Bar',
            type: 'doc',
            icon: 'bx-sidebar',
            isExpanded: true,
            attributes: [ { type: 'label', name: 'docName', value: 'launchbar_intro' } ],
            children: [
                {
                    id: '_lbAvailableLaunchers',
                    title: 'Available Launchers',
                    type: 'doc',
                    icon: 'bx-hide',
                    isExpanded: true,
                    attributes: [ { type: 'label', name: 'docName', value: 'launchbar_intro' } ],
                    children: [
                        { id: '_lbBackInHistory', title: 'Go to Previous Note', type: 'launcher', builtinWidget: 'backInHistoryButton', icon: 'bx bxs-left-arrow-square',
                            attributes: [ { type: 'label', name: 'docName', value: 'launchbar_history_navigation' } ]},
                        { id: '_lbForwardInHistory', title: 'Go to Next Note', type: 'launcher', builtinWidget: 'forwardInHistoryButton', icon: 'bx bxs-right-arrow-square',
                            attributes: [ { type: 'label', name: 'docName', value: 'launchbar_history_navigation' } ]},
                        { id: '_lbBackendLog', title: 'Backend Log', type: 'launcher', targetNoteId: '_backendLog', icon: 'bx bx-terminal' },
                    ]
                },
                {
                    id: '_lbVisibleLaunchers',
                    title: 'Visible Launchers',
                    type: 'doc',
                    icon: 'bx-show',
                    isExpanded: true,
                    attributes: [ { type: 'label', name: 'docName', value: 'launchbar_intro' } ],
                    children: [
                        { id: '_lbNewNote', title: 'New Note', type: 'launcher', command: 'createNoteIntoInbox', icon: 'bx bx-file-blank' },
                        { id: '_lbSearch', title: 'Search Notes', type: 'launcher', command: 'searchNotes', icon: 'bx bx-search', attributes: [
                                { type: 'label', name: 'desktopOnly' }
                            ] },
                        { id: '_lbJumpTo', title: 'Jump to Note', type: 'launcher', command: 'jumpToNote', icon: 'bx bx-send', attributes: [
                                { type: 'label', name: 'desktopOnly' }
                            ] },
                        { id: '_lbNoteMap', title: 'Note Map', type: 'launcher', targetNoteId: '_globalNoteMap', icon: 'bx bx-map-alt' },
                        { id: '_lbCalendar', title: 'Calendar', type: 'launcher', builtinWidget: 'calendar', icon: 'bx bx-calendar' },
                        { id: '_lbRecentChanges', title: 'Recent Changes', type: 'launcher', command: 'showRecentChanges', icon: 'bx bx-history', attributes: [
                                { type: 'label', name: 'desktopOnly' }
                            ] },
                        { id: '_lbSpacer1', title: 'Spacer', type: 'launcher', builtinWidget: 'spacer', baseSize: "50", growthFactor: "0" },
                        { id: '_lbBookmarks', title: 'Bookmarks', type: 'launcher', builtinWidget: 'bookmarks', icon: 'bx bx-bookmark' },
                        { id: '_lbToday', title: "Open Today's Journal Note", type: 'launcher', builtinWidget: 'todayInJournal', icon: 'bx bx-calendar-star' },
                        { id: '_lbSpacer2', title: 'Spacer', type: 'launcher', builtinWidget: 'spacer', baseSize: "0", growthFactor: "1" },
                        { id: '_lbProtectedSession', title: 'Protected Session', type: 'launcher', builtinWidget: 'protectedSession', icon: 'bx bx bx-shield-quarter' },
                        { id: '_lbSyncStatus', title: 'Sync Status', type: 'launcher', builtinWidget: 'syncStatus', icon: 'bx bx-wifi' }
                    ]
                }
            ]
        },
        {
            id: '_options',
            title: 'Options',
            type: 'book',
            children: [
                { id: '_optionsAppearance', title: 'Appearance', type: 'contentWidget', icon: 'bx-layout' },
                { id: '_optionsShortcuts', title: 'Shortcuts', type: 'contentWidget', icon: 'bxs-keyboard' },
                { id: '_optionsTextNotes', title: 'Text Notes', type: 'contentWidget', icon: 'bx-text' },
                { id: '_optionsCodeNotes', title: 'Code Notes', type: 'contentWidget', icon: 'bx-code' },
                { id: '_optionsImages', title: 'Images', type: 'contentWidget', icon: 'bx-image' },
                { id: '_optionsSpellcheck', title: 'Spellcheck', type: 'contentWidget', icon: 'bx-check-double' },
                { id: '_optionsPassword', title: 'Password', type: 'contentWidget', icon: 'bx-lock' },
                { id: '_optionsEtapi', title: 'ETAPI', type: 'contentWidget', icon: 'bx-extension' },
                { id: '_optionsBackup', title: 'Backup', type: 'contentWidget', icon: 'bx-data' },
                { id: '_optionsSync', title: 'Sync', type: 'contentWidget', icon: 'bx-wifi' },
                { id: '_optionsOther', title: 'Other', type: 'contentWidget', icon: 'bx-dots-horizontal' },
                { id: '_optionsAdvanced', title: 'Advanced', type: 'contentWidget' }
            ]
        }
    ]
};

function checkHiddenSubtree(force = false) {
    if (!force && !migrationService.isDbUpToDate()) {
        // on-delete hook might get triggered during some future migration and cause havoc
        log.info("Will not check hidden subtree until migration is finished.");
        return;
    }

    checkHiddenSubtreeRecursively('root', HIDDEN_SUBTREE_DEFINITION);
}

function checkHiddenSubtreeRecursively(parentNoteId, item) {
    if (!item.id || !item.type || !item.title) {
        throw new Error(`Item does not contain mandatory properties: ${JSON.stringify(item)}`);
    }

    if (item.id.charAt(0) !== '_') {
        throw new Error(`ID has to start with underscore, given '${item.id}'`);
    }

    let note = becca.notes[item.id];
    let branch;

    if (!note) {
        ({note, branch} = noteService.createNewNote({
            noteId: item.id,
            title: item.title,
            type: item.type,
            parentNoteId: parentNoteId,
            content: '',
            ignoreForbiddenParents: true
        }));
    } else {
        branch = note.getParentBranches().find(branch => branch.parentNoteId === parentNoteId);
    }

    const attrs = [...(item.attributes || [])];

    if (item.icon) {
        attrs.push({ type: 'label', name: 'iconClass', value: `bx ${item.icon}` });
    }

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
            attrs.push({ type: 'relation', name: 'target', value: item.targetNoteId });
        } else {
            throw new Error(`No action defined for launcher ${JSON.stringify(item)}`);
        }
    }

    if (note.type !== item.type) {
        // enforce correct note type
        note.type = item.type;
        note.save();
    }

    if (branch) {
        // in case of launchers the branch ID is not preserved and should not be relied upon - launchers which move between
        // visible and available will change branch since branch's parent-child relationship is immutable
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
        const attrId = note.noteId + "_" + attr.type.charAt(0) + attr.name;

        if (!note.getAttributes().find(attr => attr.attributeId === attrId)) {
            new Attribute({
                attributeId: attrId,
                noteId: note.noteId,
                type: attr.type,
                name: attr.name,
                value: attr.value,
                isInheritable: false
            }).save();
        }
    }

    for (const child of item.children || []) {
        checkHiddenSubtreeRecursively(item.id, child);
    }
}

module.exports = {
    checkHiddenSubtree,
    LBTPL_ROOT,
    LBTPL_BASE,
    LBTPL_COMMAND,
    LBTPL_NOTE_LAUNCHER,
    LBTPL_SCRIPT,
    LBTPL_BUILTIN_WIDGET,
    LBTPL_SPACER,
    LBTPL_CUSTOM_WIDGET
};
