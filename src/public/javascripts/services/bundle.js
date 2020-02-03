import ScriptContext from "./script_context.js";
import server from "./server.js";
import toastService from "./toast.js";

async function getAndExecuteBundle(noteId, originEntity = null) {
    const bundle = await server.get('script/bundle/' + noteId);

    return await executeBundle(bundle, originEntity);
}

async function executeBundle(bundle, originEntity, tabContext, $container) {
    const apiContext = await ScriptContext(bundle.noteId, bundle.allNoteIds, originEntity, tabContext, $container);

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

export default {
    executeBundle,
    getAndExecuteBundle,
    executeStartupBundles
}