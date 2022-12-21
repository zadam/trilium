import ScriptContext from "./script_context.js";
import server from "./server.js";
import toastService from "./toast.js";
import froca from "./froca.js";
import utils from "./utils.js";

async function getAndExecuteBundle(noteId, originEntity = null) {
    const bundle = await server.get(`script/bundle/${noteId}`);

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
        const note = await froca.getNote(bundle.noteId);

        toastService.showAndLogError(`Execution of JS note "${note.title}" with ID ${bundle.noteId} failed with error: ${e.message}`);
    }
}

async function executeStartupBundles() {
    const isMobile = utils.isMobile();
    const scriptBundles = await server.get("script/startup" + (isMobile ? "?mobile=true" : ""));

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
            widgetsByParent.add(widget);
        }
        catch (e) {
            logError("Widget initialization failed: ", e);
            continue;
        }
    }

    return widgetsByParent;
}

export default {
    executeBundle,
    getAndExecuteBundle,
    executeStartupBundles,
    getWidgetBundlesByParent
}
