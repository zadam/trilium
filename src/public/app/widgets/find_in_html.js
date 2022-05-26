// ck-find-result and ck-find-result_selected are the styles ck-editor
// uses for highlighting matches, use the same one on CodeMirror
// for consistency
import libraryLoader from "../services/library_loader.js";
import utils from "../services/utils.js";
import appContext from "../services/app_context.js";

const FIND_RESULT_SELECTED_CSS_CLASSNAME = "ck-find-result_selected";
const FIND_RESULT_CSS_CLASSNAME = "ck-find-result";

export default class FindInHtml {
    constructor(parent) {
        /** @property {FindWidget} */
        this.parent = parent;
        this.currentIndex = 0;
        this.$results = null;
    }

    async getInitialSearchTerm() {
        return ""; // FIXME
    }

    async performFind(searchTerm, matchCase, wholeWord) {
        await libraryLoader.requireLibrary(libraryLoader.MARKJS);

        const $content = await this.parent.noteContext.getContentElement();

        const wholeWordChar = wholeWord ? "\\b" : "";
        const regExp = new RegExp(wholeWordChar + utils.escapeRegExp(searchTerm) + wholeWordChar, matchCase ? "g" : "gi");

        return new Promise(res => {
            $content.unmark({
                done: () => {
                    $content.markRegExp(regExp, {
                        element: "span",
                        className: FIND_RESULT_CSS_CLASSNAME,
                        separateWordSearch: false,
                        caseSensitive: matchCase,
                        done: async () => {
                            this.$results = $content.find("." + FIND_RESULT_CSS_CLASSNAME);
                            this.currentIndex = 0;
                            await this.jumpTo();

                            res({
                                totalFound: this.$results.length,
                                currentFound: 1
                            });
                        }
                    });
                }
            });
        });
    }

    async findNext(direction, currentFound, nextFound) {
        if (this.$results.length) {
            this.currentIndex += direction;

            if (this.currentIndex < 0) {
                this.currentIndex = this.$results.length - 1;
            }

            if (this.currentIndex > this.$results.length - 1) {
                this.currentIndex = 0;
            }

            await this.jumpTo();
        }
    }

    async findBoxClosed(totalFound, currentFound) {
        const $content = await this.parent.noteContext.getContentElement();
        $content.unmark();
    }

    async jumpTo() {
        if (this.$results.length) {
            const offsetTop = 100;
            const $current = this.$results.eq(this.currentIndex);
            this.$results.removeClass(FIND_RESULT_SELECTED_CSS_CLASSNAME);

            if ($current.length) {
                $current.addClass(FIND_RESULT_SELECTED_CSS_CLASSNAME);
                const position = $current.position().top - offsetTop;

                const $content = await this.parent.noteContext.getContentElement();
                const $contentWiget = appContext.getComponentByEl($content);

                $contentWiget.triggerCommand("scrollContainerTo", {position});
            }
        }
    }
}
