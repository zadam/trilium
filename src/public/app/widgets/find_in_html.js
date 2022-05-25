// ck-find-result and ck-find-result_selected are the styles ck-editor
// uses for highlighting matches, use the same one on CodeMirror
// for consistency
import libraryLoader from "../services/library_loader.js";
import utils from "../services/utils.js";

const FIND_RESULT_SELECTED_CSS_CLASSNAME = "ck-find-result_selected";
const FIND_RESULT_CSS_CLASSNAME = "ck-find-result";

export default class FindInHtml {
    constructor(parent) {
        /** @property {FindWidget} */
        this.parent = parent;
    }

    async getInitialSearchTerm() {
        return ""; // FIXME
    }

    async performFind(searchTerm, matchCase, wholeWord) {
        await libraryLoader.requireLibrary(libraryLoader.MARKJS);

        const $content = await this.parent.noteContext.getContentElement();

        $content.markRegExp(new RegExp(utils.escapeRegExp(searchTerm), "gi"));
    }

    async findNext(direction, currentFound, nextFound) {
    }

    async cleanup(totalFound, currentFound) {
    }

    async close() {
    }
}
