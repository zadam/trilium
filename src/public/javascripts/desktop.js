import cloning from './services/cloning.js';
import contextMenu from './services/tree_context_menu.js';
import link from './services/link.js';
import ws from './services/ws.js';
import noteDetailService from './services/note_detail.js';
import noteType from './services/note_type.js';
import protectedSessionService from './services/protected_session.js';
import protectedSessionHolder from './services/protected_session_holder.js';
import searchNotesService from './services/search_notes.js';
import FrontendScriptApi from './services/frontend_script_api.js';
import ScriptContext from './services/script_context.js';
import sync from './services/sync.js';
import treeService from './services/tree.js';
import treeChanges from './services/branches.js';
import treeUtils from './services/tree_utils.js';
import utils from './services/utils.js';
import server from './services/server.js';
import entrypoints from './services/entrypoints.js';
import noteTooltipService from './services/note_tooltip.js';
import bundle from "./services/bundle.js";
import treeCache from "./services/tree_cache.js";
import libraryLoader from "./services/library_loader.js";
import hoistedNoteService from './services/hoisted_note.js';
import noteTypeService from './services/note_type.js';
import linkService from './services/link.js';
import noteAutocompleteService from './services/note_autocomplete.js';
import macInit from './services/mac_init.js';
import cssLoader from './services/css_loader.js';
import dateNoteService from './services/date_notes.js';
import sidebarService from './services/sidebar.js';
import importService from './services/import.js';
import keyboardActionService from "./services/keyboard_actions.js";
import splitService from "./services/split.js";
import optionService from "./services/options.js";
import noteContentRenderer from "./services/note_content_renderer.js";
import appContext from "./services/app_context.js";

window.glob.isDesktop = utils.isDesktop;
window.glob.isMobile = utils.isMobile;

// required for CKEditor image upload plugin
window.glob.getActiveNode = () => appContext.getMainNoteTree().getActiveNode();
window.glob.getHeaders = server.getHeaders;
window.glob.showAddLinkDialog = () => import('./dialogs/add_link.js').then(d => d.showDialog());
window.glob.showIncludeNoteDialog = cb => import('./dialogs/include_note.js').then(d => d.showDialog(cb));
window.glob.loadIncludedNote = async (noteId, el) => {
    const note = await treeCache.getNote(noteId);

    if (note) {
        $(el).empty().append($("<h3>").append(await linkService.createNoteLink(note.noteId, {
            showTooltip: false
        })));

        const {renderedContent} = await noteContentRenderer.getRenderedContent(note);

        $(el).append(renderedContent);
    }
};
// this is required by CKEditor when uploading images
window.glob.noteChanged = noteDetailService.noteChanged;
window.glob.refreshTree = treeService.reload;

// required for ESLint plugin
window.glob.getActiveTabNote = appContext.getActiveTabNote;
window.glob.requireLibrary = libraryLoader.requireLibrary;
window.glob.ESLINT = libraryLoader.ESLINT;

protectedSessionHolder.setProtectedSessionId(null);

window.onerror = function (msg, url, lineNo, columnNo, error) {
    const string = msg.toLowerCase();

    let message = "Uncaught error: ";

    if (string.includes("Cannot read property 'defaultView' of undefined")) {
        // ignore this specific error which is very common but we don't know where it comes from
        // and it seems to be harmless
        return true;
    }
    else if (string.includes("script error")) {
        message += 'No details available';
    }
    else {
        message += [
            'Message: ' + msg,
            'URL: ' + url,
            'Line: ' + lineNo,
            'Column: ' + columnNo,
            'Error object: ' + JSON.stringify(error)
        ].join(' - ');
    }

    ws.logError(message);

    return false;
};

for (const appCssNoteId of window.appCssNoteIds) {
    cssLoader.requireCss(`api/notes/download/${appCssNoteId}`);
}

const wikiBaseUrl = "https://github.com/zadam/trilium/wiki/";

$(document).on("click", "button[data-help-page]", e => {
    const $button = $(e.target);

    window.open(wikiBaseUrl + $button.attr("data-help-page"), '_blank');
});

$("#logout-button").toggle(!utils.isElectron());

$("#logout-button").on('click', () => {
    const $logoutForm = $('<form action="logout" method="POST">')
                            .append($(`<input type="hidden" name="_csrf" value="${glob.csrfToken}"/>`));

    $("body").append($logoutForm);
    $logoutForm.trigger('submit');
});

$("body").on("click", "a.external", function () {
    window.open($(this).attr("href"), '_blank');
});

if (utils.isElectron()) {
    require('electron').ipcRenderer.on('globalShortcut', async function(event, actionName) {
        keyboardActionService.triggerAction(actionName);
    });
}

const $noteTabContainer = $("#note-tab-container");

$noteTabContainer.on("click", ".export-note-button", function () {
    if ($(this).hasClass("disabled")) {
        return;
    }

    import('./dialogs/export.js').then(d => d.showDialog(appContext.getMainNoteTree().getActiveNode(), 'single'));
});

$noteTabContainer.on("click", ".import-files-button",
    () => import('./dialogs/import.js').then(d => d.showDialog(appContext.getMainNoteTree().getActiveNode())));

async function printActiveNote() {
    if ($(this).hasClass("disabled")) {
        return;
    }

    const $tabContext = appContext.getActiveTabContext();
    if (!$tabContext) {
        return;
    }

    await libraryLoader.requireLibrary(libraryLoader.PRINT_THIS);

    $tabContext.$tabContent.find('.note-detail-component:visible').printThis({
        header: $("<h2>").text($tabContext.note && $tabContext.note.title).prop('outerHTML') ,
        importCSS: false,
        loadCSS: [
            "libraries/codemirror/codemirror.css",
            "libraries/ckeditor/ckeditor-content.css"
        ],
        debug: true
    });
}

keyboardActionService.setGlobalActionHandler("PrintActiveNote", printActiveNote);

$noteTabContainer.on("click", ".print-note-button", printActiveNote);

$('[data-toggle="tooltip"]').tooltip({
    html: true
});

// for CKEditor integration (button on block toolbar)
window.glob.importMarkdownInline = async () => {
    const dialog = await import("./dialogs/markdown_import.js");

    dialog.importMarkdownInline();
};

macInit.init();

searchNotesService.init(); // should be in front of treeService since that one manipulates address bar hash

appContext.showWidgets();

entrypoints.registerEntrypoints();

noteTooltipService.setupGlobalTooltip();

noteAutocompleteService.init();

if (utils.isElectron()) {
    import("./services/spell_check.js").then(spellCheckService => spellCheckService.initSpellCheck());
}

optionService.waitForOptions().then(options => {
    if (utils.isElectron() && !options.is('nativeTitleBarVisible')) {
        $("#title-bar-buttons").show();

        $("#minimize-btn").on('click', () => {
            $("#minimize-btn").trigger('blur');
            const {remote} = require('electron');
            remote.BrowserWindow.getFocusedWindow().minimize();
        });

        $("#maximize-btn").on('click', () => {
            $("#maximize-btn").trigger('blur');
            const {remote} = require('electron');
            const focusedWindow = remote.BrowserWindow.getFocusedWindow();

            if (focusedWindow.isMaximized()) {
                focusedWindow.unmaximize();
            } else {
                focusedWindow.maximize();
            }
        });

        $("#close-btn").on('click', () => {
            $("#close-btn").trigger('blur');
            const {remote} = require('electron');
            remote.BrowserWindow.getFocusedWindow().close();
        });
    }
});