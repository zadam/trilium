import ScriptContext from "./script_context.js";
import server from "./server.js";

async function executeBundle(bundle) {
    const apiContext = ScriptContext(bundle.note, bundle.allNotes);

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
    executeStartupBundles
}