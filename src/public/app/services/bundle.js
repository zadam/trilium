import ScriptContext from "./script_context.js";
import server from "./server.js";
import toastService from "./toast.js";

async function getAndExecuteBundle(noteId, originEntity = null) {
    const bundle = await server.get('script/bundle/' + noteId);

    return await executeBundle(bundle, originEntity);
}

async function executeBundle(bundle, originEntity, $container) {
    const apiContext = await ScriptContext(bundle.noteId, bundle.allNoteIds, originEntity, $container);

    try {
        return await (function () {
            return eval(`const apiContext = this; (async function() { ${bundle.script}\r\n})()`);
        }.call(apiContext));
    }
    catch (e) {
        toastService.showAndLogError(`Execution of ${bundle.noteId} failed with error: ${e.message}`);
    }
}

async function executeStartupBundles() {
    const scriptBundles = await server.get("script/startup");

    for (const bundle of scriptBundles) {
        await executeBundle(bundle);
    }
}

class WidgetsByParent {
    constructor() {
        this.byParent = {};
    }

    add(widget) {
        if (!widget.parentWidget) {
            console.log(`Custom widget does not have mandatory 'getParent()' method defined`);
            return;
        }

        this.byParent[widget.parentWidget] = this.byParent[widget.parentWidget] || [];
        this.byParent[widget.parentWidget].push(widget);
    }

    get(parentName) {
        return this.byParent[parentName] || [];
    }
}

async function getWidgetBundlesByParent() {
    const scriptBundles = await server.get("script/widgets");

    const widgetsByParent = new WidgetsByParent();

    for (const bundle of scriptBundles) {
        let widget;

        try {
            widget = await executeBundle(bundle);
        }
        catch (e) {
            console.error("Widget initialization failed: ", e);
            continue;
        }

        widgetsByParent.add(widget);
    }

    return widgetsByParent;
}

export default {
    executeBundle,
    getAndExecuteBundle,
    executeStartupBundles,
    getWidgetBundlesByParent
}
