import server from "./server.js";
import treeCache from "./tree_cache.js";
import bundleService from "./bundle.js";
import DialogCommandExecutor from "./dialog_command_executor.js";
import Entrypoints from "./entrypoints.js";
import options from "./options.js";
import utils from "./utils.js";
import ZoomService from "./zoom.js";
import Layout from "../widgets/layout.js";
import TabManager from "./tab_manager.js";
import treeService from "./tree.js";
import Component from "../widgets/component.js";

class AppContext extends Component {
    constructor(layout) {
        super(null);

        this.layout = layout;
        this.tabManager = new TabManager(this);
        this.executors = [];
    }

    async start() {
        options.load(await server.get('options'));

        this.showWidgets();

        this.tabManager.loadTabs();

        bundleService.executeStartupBundles();
    }

    showWidgets() {
        const rootWidget = this.layout.getRootWidget(this);
        const $renderedWidget = rootWidget.render();

        $("body").append($renderedWidget);

        $renderedWidget.on('click', "[data-trigger-event]", e => {
            const eventName = $(e.target).attr('data-trigger-event');

            this.triggerEvent(eventName);
        });

        this.children = [
            this.tabManager,
            rootWidget,
            new Entrypoints(this)
        ];

        this.executors = [
            new DialogCommandExecutor(this)
        ];

        if (utils.isElectron()) {
            this.children.push(new ZoomService(this));

            import("./spell_check.js").then(spellCheckService => spellCheckService.initSpellCheck());
        }

        this.triggerEvent('initialRenderComplete');
    }

    async triggerEvent(name, data) {
        await this.handleEvent(name, data);
    }

    async triggerCommand(name, data = {}) {
        for (const executor of this.executors) {
            const fun = executor[name + 'Command'];

            const called = await this.callMethod(executor, fun, data);

            if (called) {
                return;
            }
        }

        console.error(`Unhandled command ${name}`);
    }

    getComponentByEl(el) {
        return $(el).closest(".component").prop('component');
    }

    async protectedSessionStartedEvent() {
        await treeCache.loadInitialTree();

        this.triggerEvent('treeCacheReloaded');
    }
}

const layout = new Layout();

const appContext = new AppContext(layout);

// we should save all outstanding changes before the page/app is closed
$(window).on('beforeunload', () => {
    appContext.triggerEvent('beforeUnload');
});

function isNotePathInAddress() {
    const [notePath, tabId] = getHashValueFromAddress();

    return notePath.startsWith("root")
        // empty string is for empty/uninitialized tab
        || (notePath === '' && !!tabId);
}

$(window).on('hashchange', function() {
    if (isNotePathInAddress()) {
        const [notePath, tabId] = treeService.getHashValueFromAddress();

        appContext.tabManager.switchToTab(tabId, notePath);
    }
});

export default appContext;