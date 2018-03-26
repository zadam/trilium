import ScriptContext from "./script_context";

async function executeBundle(bundle) {
    const apiContext = ScriptContext(bundle.note, bundle.allNotes);

    return await (function () {
        return eval(`const apiContext = this; (async function() { ${bundle.script}\r\n})()`);
    }.call(apiContext));
}

export default {
    executeBundle
}