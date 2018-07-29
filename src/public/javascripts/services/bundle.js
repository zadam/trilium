import ScriptContext from "./script_context.js";
import server from "./server.js";

async function getAndExecuteBundle(noteId, targetNote = null) {
    const bundle = await server.get('script/bundle/' + noteId);

    await executeBundle(bundle, targetNote);
}

async function executeBundle(bundle, targetNote) {
    const apiContext = ScriptContext(bundle.note, bundle.allNotes, targetNote);

    return await (function () {
        return eval(`const apiContext = this; (async function() { ${bundle.script}\r\n})()`);
    }.call(apiContext));
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