import appContext from "./services/app_context.js";
import utils from './services/utils.js';
import noteTooltipService from './services/note_tooltip.js';
import bundleService from "./services/bundle.js";
import noteAutocompleteService from './services/note_autocomplete.js';
import macInit from './services/mac_init.js';
import contextMenu from "./services/context_menu.js";
import DesktopLayout from "./layouts/desktop_layout.js";
import glob from "./services/glob.js";
import zoomService from './services/zoom.js';

glob.setupGlobs();

if (utils.isElectron()) {
    utils.dynamicRequire('electron').ipcRenderer.on('globalShortcut', async function(event, actionName) {
        appContext.triggerCommand(actionName);
    });
}

$('[data-toggle="tooltip"]').tooltip({
    html: true
});

macInit.init();

bundleService.getWidgetBundlesByParent().then(widgetBundles => {
    appContext.setLayout(new DesktopLayout(widgetBundles));
    appContext.start();
});

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
                ? (params.selectionText.substr(0, 13) + "…")
                : params.selectionText;

            items.push({
                enabled: editFlags.canPaste,
                title: `Search for "${shortenedSelection}" with DuckDuckGo`,
                uiIcon: "bx bx-search-alt",
                handler: () => electron.shell.openExternal(`https://duckduckgo.com/?q=${encodeURIComponent(params.selectionText)}`)
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
