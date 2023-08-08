import appContext from "./components/app_context.js";
import utils from './services/utils.js';
import noteTooltipService from './services/note_tooltip.js';
import bundleService from "./services/bundle.js";
import noteAutocompleteService from './services/note_autocomplete.js';
import macInit from './services/mac_init.js';
import electronContextMenu from "./menus/electron_context_menu.js";
import DesktopLayout from "./layouts/desktop_layout.js";
import glob from "./services/glob.js";

bundleService.getWidgetBundlesByParent().then(widgetBundles => {
    appContext.setLayout(new DesktopLayout(widgetBundles));
    appContext.start();
});

glob.setupGlobs();

if (utils.isElectron()) {
    utils.dynamicRequire('electron').ipcRenderer.on('globalShortcut',
        async (event, actionName) => appContext.triggerCommand(actionName));
}

macInit.init();

noteTooltipService.setupGlobalTooltip();

noteAutocompleteService.init();

if (utils.isElectron()) {
    electronContextMenu.setupContextMenu();
}
