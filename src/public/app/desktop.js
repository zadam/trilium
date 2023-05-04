import appContext from "./components/app_context.js";
import utils from './services/utils.js';
import noteTooltipService from './services/note_tooltip.js';
import bundleService from "./services/bundle.js";
import noteAutocompleteService from './services/note_autocomplete.js';
import macInit from './services/mac_init.js';
import contextMenu from "./menus/context_menu.js";
import DesktopLayout from "./layouts/desktop_layout.js";
import glob from "./services/glob.js";
import zoomService from './components/zoom.js';
import options from "./services/options.js";

bundleService.getWidgetBundlesByParent().then(widgetBundles => {
    appContext.setLayout(new DesktopLayout(widgetBundles));
    appContext.start();
});

glob.setupGlobs();

if (utils.isElectron()) {
    utils.dynamicRequire('electron').ipcRenderer.on('globalShortcut', async function(event, actionName) {
        appContext.triggerCommand(actionName);
    });
}

macInit.init();

noteTooltipService.setupGlobalTooltip();

noteAutocompleteService.init();

if (utils.isElectron()) {
    const electron = utils.dynamicRequire('electron');

    const remote = utils.dynamicRequire('@electron/remote');
    const {webContents} = remote.getCurrentWindow();

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
                    uiIcon: "bx bx-empty"
                });
            }

            items.push({
                title: `Add "${params.misspelledWord}" to dictionary`,
                uiIcon: "bx bx-plus",
                handler: () => webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
            });

            items.push({ title: `----` });
        }

        if (params.isEditable) {
            items.push({
                enabled: editFlags.canCut && hasText,
                title: `Cut <kbd>${platformModifier}+X`,
                uiIcon: "bx bx-cut",
                handler: () => webContents.cut()
            });
        }

        if (params.isEditable || hasText) {
            items.push({
                enabled: editFlags.canCopy && hasText,
                title: `Copy <kbd>${platformModifier}+C`,
                uiIcon: "bx bx-copy",
                handler: () => webContents.copy()
            });
        }

        if (!["", "javascript:", "about:blank#blocked"].includes(params.linkURL) && params.mediaType === 'none') {
            items.push({
                title: `Copy link`,
                uiIcon: "bx bx-copy",
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
                uiIcon: "bx bx-paste",
                handler: () => webContents.paste()
            });
        }

        if (params.isEditable) {
            items.push({
                enabled: editFlags.canPaste,
                title: `Paste as plain text <kbd>${platformModifier}+Shift+V`,
                uiIcon: "bx bx-paste",
                handler: () => webContents.pasteAndMatchStyle()
            });
        }

        if (hasText) {
            const shortenedSelection = params.selectionText.length > 15
                ? (`${params.selectionText.substr(0, 13)}…`)
                : params.selectionText;

            // Read the search engine from the options and fallback to DuckDuckGo if the option is not set.
            const customSearchEngineName = options.get("customSearchEngineName");
            const customSearchEngineUrl = options.get("customSearchEngineUrl");
            let searchEngineName;
            let searchEngineUrl;
            if (customSearchEngineName && customSearchEngineUrl) {
                searchEngineName = customSearchEngineName;
                searchEngineUrl = customSearchEngineUrl;
            } else {
                searchEngineName = "Duckduckgo";
                searchEngineUrl = "https://duckduckgo.com/?q={keyword}";
            }

            // Replace the placeholder with the real search keyword.
            let searchUrl = searchEngineUrl.replace("{keyword}", encodeURIComponent(params.selectionText));

            items.push({
                enabled: editFlags.canPaste,
                title: `Search for "${shortenedSelection}" with ${searchEngineName}`,
                uiIcon: "bx bx-search-alt",
                handler: () => electron.shell.openExternal(searchUrl)
            });
        }

        if (items.length === 0) {
            return;
        }

        const zoomLevel = zoomService.getCurrentZoom();

        contextMenu.show({
            x: params.x / zoomLevel,
            y: params.y / zoomLevel,
            items,
            selectMenuItemHandler: ({command, spellingSuggestion}) => {
                if (command === 'replaceMisspelling') {
                    webContents.insertText(spellingSuggestion);
                }
            }
        });
    });
}
