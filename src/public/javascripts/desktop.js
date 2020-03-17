import glob from './services/glob.js';
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
import contextMenu from "./services/context_menu.js";
import DesktopLayout from "./widgets/desktop_layout.js";
import bundleService from "./services/bundle.js";

if (utils.isElectron()) {
    require('electron').ipcRenderer.on('globalShortcut', async function(event, actionName) {
        appContext.triggerCommand(actionName);
    });
}

$('[data-toggle="tooltip"]').tooltip({
    html: true
});

macInit.init();

bundleService.getWidgetBundlesByParent().then(widgetBundles => {
    const desktopLayout = new DesktopLayout(widgetBundles);

    appContext.setLayout(desktopLayout);
    appContext.start();
});

noteTooltipService.setupGlobalTooltip();

noteAutocompleteService.init();

if (utils.isElectron()) {
    const electron = require('electron');
    const {webContents} = electron.remote.getCurrentWindow();

    webContents.on('context-menu', (event, params) => {
        const {editFlags} = params;
        const hasText = params.selectionText.trim().length > 0;
        const isMac = process.platform === "darwin";
        const platformModifier = isMac ? 'Meta' : 'Ctrl';

        const items = [];

        if (params.misspelledWord) {
            for (const suggestion of params.dictionarySuggestions) {
                items.push({
                    title: suggestion,
                    command: "replaceMisspelling",
                    spellingSuggestion: suggestion,
                    uiIcon: "empty"
                });
            }

            items.push({
                title: `Add "${params.misspelledWord}" to dictionary`,
                uiIcon: "plus",
                handler: () => webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
            });

            items.push({ title: `----` });
        }

        if (params.isEditable) {
            items.push({
                enabled: editFlags.canCut && hasText,
                title: `Cut <kbd>${platformModifier}+X`,
                uiIcon: "cut",
                handler: () => webContents.cut()
            });
        }

        if (params.isEditable || hasText) {
            items.push({
                enabled: editFlags.canCopy && hasText,
                title: `Copy <kbd>${platformModifier}+C`,
                uiIcon: "copy",
                handler: () => webContents.copy()
            });
        }

        if (params.linkURL.length !== 0 && params.mediaType === 'none') {
            items.push({
                title: `Copy link`,
                uiIcon: "copy",
                handler: () => {
                    electron.clipboard.write({
                        bookmark: params.linkText,
                        text: params.linkURL
                    });
                }
            });
        }

        if (params.isEditable) {
            items.push({
                enabled: editFlags.canPaste,
                title: `Paste <kbd>${platformModifier}+V`,
                uiIcon: "paste",
                handler: () => webContents.paste()
            });
        }

        if (params.isEditable) {
            items.push({
                enabled: editFlags.canPaste,
                title: `Paste as plain text <kbd>${platformModifier}+Shift+V`,
                uiIcon: "paste",
                handler: () => webContents.pasteAndMatchStyle()
            });
        }

        if (hasText) {
            const shortenedSelection = params.selectionText.length > 15
                ? (params.selectionText.substr(0, 13) + "…")
                : params.selectionText;

            items.push({
                enabled: editFlags.canPaste,
                title: `Search for "${shortenedSelection}" with DuckDuckGo`,
                uiIcon: "search-alt",
                handler: () => electron.shell.openExternal(`https://duckduckgo.com/?q=${encodeURIComponent(params.selectionText)}`)
            });
        }

        if (items.length === 0) {
            return;
        }

        contextMenu.show({
            x: params.x,
            y: params.y,
            items,
            selectMenuItemHandler: ({command, spellingSuggestion}) => {
                if (command === 'replaceMisspelling') {
                    console.log("Replacing missspeling", spellingSuggestion);

                    webContents.insertText(spellingSuggestion);
                }
            }
        });
    });
}