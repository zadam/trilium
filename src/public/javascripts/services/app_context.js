import server from "./server.js";
import treeCache from "./tree_cache.js";
import bundleService from "./bundle.js";
import DialogEventComponent from "./dialog_events.js";
import Entrypoints from "./entrypoints.js";
import options from "./options.js";
import utils from "./utils.js";
import ZoomService from "./zoom.js";
import Layout from "../widgets/layout.js";
import TabManager from "./tab_manager.js";

class AppContext {
    constructor(layout) {
        this.layout = layout;
        this.tabManager = new TabManager(this);
        this.components = [this.tabManager];
    }

    async start() {
        options.load(await server.get('options'));

        this.showWidgets();

        this.tabManager.loadTabs();

        bundleService.executeStartupBundles();
    }

    showWidgets() {
        const rootContainer = this.layout.getRootWidget(this);

        $("body").append(rootContainer.render());

        this.components = [
            rootContainer,
            new Entrypoints(this),
            new DialogEventComponent(this)
        ];

        if (utils.isElectron()) {
            this.components.push(new ZoomService(this));

            import("./spell_check.js").then(spellCheckService => spellCheckService.initSpellCheck());
        }

        this.trigger('initialRenderComplete');
    }

    trigger(name, data, sync = false) {
        this.eventReceived(name, data);

        for (const component of this.components) {
            component.eventReceived(name, data, sync);
        }
    }

    async eventReceived(name, data, sync) {
        const fun = this[name + 'Listener'];

        if (typeof fun === 'function') {
            await fun.call(this, data, sync);
        }
    }

    hoistedNoteChangedListener({hoistedNoteId}) {
        if (hoistedNoteId === 'root') {
            return;
        }

        for (const tc of this.tabManager.getTabContexts()) {
            if (tc.notePath && !tc.notePath.split("/").includes(hoistedNoteId)) {
                this.tabManager.removeTab(tc.tabId);
            }
        }

        if (this.tabManager.getTabContexts().length === 0) {
            this.tabManager.openAndActivateEmptyTab();
        }
    }

    async protectedSessionStartedListener() {
        await treeCache.loadInitialTree();

        this.trigger('treeCacheReloaded');
    }
}

const layout = new Layout();

const appContext = new AppContext(layout);

// we should save all outstanding changes before the page/app is closed
$(window).on('beforeunload', () => {
    appContext.trigger('beforeUnload');
});

function isNotePathInAddress() {
    const [notePath, tabId] = getHashValueFromAddress();

    return notePath.startsWith("root")
        // empty string is for empty/uninitialized tab
        || (notePath === '' && !!tabId);
}

function getHashValueFromAddress() {
    const str = document.location.hash ? document.location.hash.substr(1) : ""; // strip initial #

    return str.split("-");
}

$(window).on('hashchange', function() {
    if (isNotePathInAddress()) {
        const [notePath, tabId] = getHashValueFromAddress();

        appContext.switchToTab(tabId, notePath);
    }
});

export default appContext;