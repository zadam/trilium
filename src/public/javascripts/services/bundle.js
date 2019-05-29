import ScriptContext from "./script_context.js";
import server from "./server.js";
import infoService from "./info.js";

async function getAndExecuteBundle(noteId, originEntity = null) {
    const bundle = await server.get('script/bundle/' + noteId);

    await executeBundle(bundle, originEntity);
}

async function executeBundle(bundle, originEntity, tabContext) {
    const apiContext = await ScriptContext(bundle.noteId, bundle.allNoteIds, originEntity, tabContext);

    try {
        return await (function () {
            return eval(`const apiContext = this; (async function() { ${bundle.script}\r\n})()`);
        }.call(apiContext));
    }
    catch (e) {
        infoService.showAndLogError(`Execution of ${bundle.noteId} failed with error: ${e.message}`);
    }
}

async function executeStartupBundles() {
    const scriptBundles = await server.get("script/startup");

    for (const bundle of scriptBundles) {
        await executeBundle(bundle);
    }
}

async function executeRelationBundles(note, relationName, tabContext) {
    note.bundleCache = note.bundleCache || {};

    if (!note.bundleCache[relationName]) {
        note.bundleCache[relationName] = await server.get("script/relation/" + note.noteId + "/" + relationName);
    }

    for (const bundle of note.bundleCache[relationName]) {
        await executeBundle(bundle, note, tabContext);
    }
}

export default {
    executeBundle,
    getAndExecuteBundle,
    executeStartupBundles,
    executeRelationBundles
}