import contextMenu from './services/tree_context_menu.js';
import link from './services/link.js';
import ws from './services/ws.js';
import noteType from './widgets/note_type.js';
import protectedSessionService from './services/protected_session.js';
import protectedSessionHolder from './services/protected_session_holder.js';
import FrontendScriptApi from './services/frontend_script_api.js';
import ScriptContext from './services/script_context.js';
import sync from './services/sync.js';
import treeService from './services/tree.js';
import branchService from './services/branches.js';
import utils from './services/utils.js';
import server from './services/server.js';
import Entrypoints from './services/entrypoints.js';
import noteTooltipService from './services/note_tooltip.js';
import bundle from "./services/bundle.js";
import treeCache from "./services/tree_cache.js";
import libraryLoader from "./services/library_loader.js";
import hoistedNoteService from './services/hoisted_note.js';
import noteTypeService from './widgets/note_type.js';
import linkService from './services/link.js';
import noteAutocompleteService from './services/note_autocomplete.js';
import macInit from './services/mac_init.js';
import dateNoteService from './services/date_notes.js';
import importService from './services/import.js';
import keyboardActionService from "./services/keyboard_actions.js";
import splitService from "./services/split.js";
import options from "./services/options.js";
import noteContentRenderer from "./services/note_content_renderer.js";
import appContext from "./services/app_context.js";
import FlexContainer from "./widgets/flex_container.js";
import GlobalMenuWidget from "./widgets/global_menu.js";
import TabRowWidget from "./widgets/tab_row.js";
import TitleBarButtonsWidget from "./widgets/title_bar_buttons.js";
import StandardTopWidget from "./widgets/standard_top_widget.js";
import SidePaneContainer from "./widgets/side_pane_container.js";
import GlobalButtonsWidget from "./widgets/global_buttons.js";
import SearchBoxWidget from "./widgets/search_box.js";
import SearchResultsWidget from "./widgets/search_results.js";
import NoteTreeWidget from "./widgets/note_tree.js";
import TabCachingWidget from "./widgets/tab_caching_widget.js";
import NotePathsWidget from "./widgets/note_paths.js";
import NoteTitleWidget from "./widgets/note_title.js";
import RunScriptButtonsWidget from "./widgets/run_script_buttons.js";
import ProtectedNoteSwitchWidget from "./widgets/protected_note_switch.js";
import NoteTypeWidget from "./widgets/note_type.js";
import NoteActionsWidget from "./widgets/note_actions.js";
import PromotedAttributesWidget from "./widgets/promoted_attributes.js";
import NoteDetailWidget from "./widgets/note_detail.js";
import NoteInfoWidget from "./widgets/note_info.js";
import CalendarWidget from "./widgets/calendar.js";
import AttributesWidget from "./widgets/attributes.js";
import LinkMapWidget from "./widgets/link_map.js";
import NoteRevisionsWidget from "./widgets/note_revisions.js";
import SimilarNotesWidget from "./widgets/similar_notes.js";
import WhatLinksHereWidget from "./widgets/what_links_here.js";
import SidePaneToggles from "./widgets/side_pane_toggles.js";
import EmptyTypeWidget from "./widgets/type_widgets/empty.js";
import TextTypeWidget from "./widgets/type_widgets/text.js";
import CodeTypeWidget from "./widgets/type_widgets/code.js";
import FileTypeWidget from "./widgets/type_widgets/file.js";
import ImageTypeWidget from "./widgets/type_widgets/image.js";
import SearchTypeWidget from "./widgets/type_widgets/search.js";
import RenderTypeWidget from "./widgets/type_widgets/render.js";
import RelationMapTypeWidget from "./widgets/type_widgets/relation_map.js";
import ProtectedSessionTypeWidget from "./widgets/type_widgets/protected_session.js";
import BookTypeWidget from "./widgets/type_widgets/book.js";

window.glob.PROFILING_LOG = false;

window.glob.isDesktop = utils.isDesktop;
window.glob.isMobile = utils.isMobile;

window.glob.getComponentByEl = el => appContext.getComponentByEl(el);
window.glob.getHeaders = server.getHeaders;

// required for ESLint plugin and CKEditor
window.glob.getActiveTabNote = () => appContext.tabManager.getActiveTabNote();
window.glob.requireLibrary = libraryLoader.requireLibrary;
window.glob.ESLINT = libraryLoader.ESLINT;
window.glob.appContext = appContext; // for debugging

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
    libraryLoader.requireCss(`api/notes/download/${appCssNoteId}`);
}

const wikiBaseUrl = "https://github.com/zadam/trilium/wiki/";

$(document).on("click", "button[data-help-page]", e => {
    const $button = $(e.target);

    window.open(wikiBaseUrl + $button.attr("data-help-page"), '_blank');
});

$("body").on("click", "a.external", function () {
    window.open($(this).attr("href"), '_blank');
});

if (utils.isElectron()) {
    require('electron').ipcRenderer.on('globalShortcut', async function(event, actionName) {
        keyboardActionService.triggerAction(actionName);
    });
}

$('[data-toggle="tooltip"]').tooltip({
    html: true
});

// for CKEditor integration (button on block toolbar)
window.glob.importMarkdownInline = async () => {
    const dialog = await import("./dialogs/markdown_import.js");

    dialog.importMarkdownInline();
};

window.glob.SEARCH_HELP_TEXT = `
<strong>Search tips</strong> - also see <button class="btn btn-sm" type="button" data-help-page="Search">complete help on search</button>
<p>
<ul>
    <li>Just enter any text for full text search</li>
    <li><code>@abc</code> - returns notes with label abc</li>
    <li><code>@year=2019</code> - matches notes with label <code>year</code> having value <code>2019</code></li>
    <li><code>@rock @pop</code> - matches notes which have both <code>rock</code> and <code>pop</code> labels</li>
    <li><code>@rock or @pop</code> - only one of the labels must be present</li>
    <li><code>@year&lt;=2000</code> - numerical comparison (also &gt;, &gt;=, &lt;).</li>
    <li><code>@dateCreated>=MONTH-1</code> - notes created in the last month</li>
    <li><code>=handler</code> - will execute script defined in <code>handler</code> relation to get results</li>
</ul>
</p>`;

macInit.init();

appContext.start();

noteTooltipService.setupGlobalTooltip();

noteAutocompleteService.init();