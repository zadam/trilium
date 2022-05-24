import froca from "./froca.js";
import bundleService from "./bundle.js";
import RootCommandExecutor from "./root_command_executor.js";
import Entrypoints from "./entrypoints.js";
import options from "./options.js";
import utils from "./utils.js";
import zoomService from "./zoom.js";
import TabManager from "./tab_manager.js";
import treeService from "./tree.js";
import Component from "../widgets/component.js";
import keyboardActionsService from "./keyboard_actions.js";
import MobileScreenSwitcherExecutor from "../widgets/mobile_widgets/mobile_screen_switcher.js";
import MainTreeExecutors from "./main_tree_executors.js";
import toast from "./toast.js";

class AppContext extends Component {
    constructor(isMainWindow) {
        super();

        this.isMainWindow = isMainWindow;
        this.executors = [];
        this.beforeUnloadListeners = [];
    }

    setLayout(layout) {
        this.layout = layout;
    }

    async start() {
        await Promise.all([froca.initializedPromise, options.initializedPromise]);

        this.showWidgets();

        this.tabManager.loadTabs();

        setTimeout(() => bundleService.executeStartupBundles(), 2000);
    }

    showWidgets() {
        const rootWidget = this.layout.getRootWidget(this);
        const $renderedWidget = rootWidget.render();

        keyboardActionsService.updateDisplayedShortcuts($renderedWidget);

        $("body").append($renderedWidget);

        $renderedWidget.on('click', "[data-trigger-command]", function() {
            const commandName = $(this).attr('data-trigger-command');
            const $component = $(this).closest(".component");
            const component = $component.prop("component");

            component.triggerCommand(commandName, {$el: $(this)});
        });

        this.tabManager = new TabManager();

        this.executors = [
            this.tabManager,
            new RootCommandExecutor(),
            new Entrypoints(),
            new MainTreeExecutors()
        ];

        if (utils.isMobile()) {
            this.executors.push(new MobileScreenSwitcherExecutor());
        }

        this.child(rootWidget);

        for (const executor of this.executors) {
            this.child(executor);
        }

        if (utils.isElectron()) {
            this.child(zoomService);
        }

        this.triggerEvent('initialRenderComplete');
    }

    /** @returns {Promise} */
    triggerEvent(name, data) {
        return this.handleEvent(name, data);
    }

    /** @returns {Promise} */
    triggerCommand(name, data = {}) {
        for (const executor of this.executors) {
            const fun = executor[name + "Command"];

            if (fun) {
                return executor.callMethod(fun, data);
            }
        }

        // this might hint at error but sometimes this is used by components which are at different places
        // in the component tree to communicate with each other
        console.debug(`Unhandled command ${name}, converting to event.`);

        return this.triggerEvent(name, data);
    }

    getComponentByEl(el) {
        return $(el).closest(".component").prop('component');
    }

    addBeforeUnloadListener(obj) {
        if (typeof WeakRef !== "function") {
            // older browsers don't support WeakRef
            return;
        }

        this.beforeUnloadListeners.push(new WeakRef(obj));
    }
}

const appContext = new AppContext(window.glob.isMainWindow);

// we should save all outstanding changes before the page/app is closed
$(window).on('beforeunload', () => {
    let allSaved = true;

    appContext.beforeUnloadListeners = appContext.beforeUnloadListeners.filter(wr => !!wr.deref());

    for (const weakRef of appContext.beforeUnloadListeners) {
        const component = weakRef.deref();

        if (!component) {
            continue;
        }

        if (!component.beforeUnloadEvent()) {
            console.log(`Component ${component.componentId} is not finished saving its state.`);

            toast.showMessage("Please wait for a couple of seconds for the save to finish, then you can try again.", 10000);

            allSaved = false;
        }
    }

    if (!allSaved) {
        return "some string";
    }
});

function isNotePathInAddress() {
    const [notePath, ntxId] = treeService.getHashValueFromAddress();

    return notePath.startsWith("root")
        // empty string is for empty/uninitialized tab
        || (notePath === '' && !!ntxId);
}

$(window).on('hashchange', function() {
    if (isNotePathInAddress()) {
        const [notePath, ntxId] = treeService.getHashValueFromAddress();

        if (!notePath) {
            console.log(`Invalid hash value "${document.location.hash}", ignoring.`);
            return;
        }

        appContext.tabManager.switchToNoteContext(ntxId, notePath);
    }
});

export default appContext;
