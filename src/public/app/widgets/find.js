/**
 * (c) Antonio Tejada 2022
 * https://github.com/antoniotejada/Trilium-FindWidget
 */

import NoteContextAwareWidget from "./note_context_aware_widget.js";
import appContext from "../services/app_context.js";
import FindInText from "./find_in_text.js";
import FindInCode from "./find_in_code.js";

const findWidgetDelayMillis = 200;
const waitForEnter = (findWidgetDelayMillis < 0);

// tabIndex=-1 on the checkbox labels is necessary so when clicking on the label
// the focusout handler is called with relatedTarget equal to the label instead
// of undefined. It's -1 instead of > 0, so they don't tabstop
const TPL = `
<div style="contain: none;">
    <style>
        .find-widget-box {
            padding: 10px;
            border-top: 1px solid var(--main-border-color); 
            align-items: center;
        }
        
        .find-widget-box > * {
            margin-right: 15px;
        }
        
        .find-widget-box {
            display: flex;
        }
        
        .find-widget-found-wrapper {
            font-weight: bold;
        }
    </style>

    <div class="find-widget-box">
        <input type="text" class="font-control find-widget-search-term-input">
        
        <div class="form-check">
            <label tabIndex="-1" class="form-check-label">
                <input type="checkbox" class="form-check-input find-widget-case-sensitive-checkbox"> 
                case sensitive
            </label>
        </div>

        <div class="form-check">
            <label tabIndex="-1" class="form-check-label">
                <input type="checkbox" class="form-check-input find-widget-match-words-checkbox"> 
                match words
            </label>
        </div>
        
        <div class="find-widget-found-wrapper">
            <span class="find-widget-current-found">0</span>
            /
            <span class="find-widget-total-found">0</span>
        </div>
    </div>
</div>`;

export default class FindWidget extends NoteContextAwareWidget {
    constructor() {
        super();

        this.textHandler = new FindInText();
        this.codeHandler = new FindInCode();
    }

    doRender() {
        this.$widget = $(TPL);
        this.$findBox = this.$widget.find('.find-widget-box');
        this.$findBox.hide();
        this.$input = this.$widget.find('.find-widget-search-term-input');
        this.$currentFound = this.$widget.find('.find-widget-current-found');
        this.$totalFound = this.$widget.find('.find-widget-total-found');
        this.$caseSensitiveCheckbox = this.$widget.find(".find-widget-case-sensitive-checkbox");
        this.$caseSensitiveCheckbox.change(() => this.performFind());
        this.$matchWordsCheckbox = this.$widget.find(".find-widget-match-words-checkbox");
        this.$matchWordsCheckbox.change(() => this.performFind());
        this.findResult = null;
        this.searchTerm = null;

        this.$input.keydown(async e => {
            if ((e.metaKey || e.ctrlKey) && (e.key === 'F' || e.key === 'f')) {
                // If ctrl+f is pressed when the findbox is shown, select the
                // whole input to find
                this.$input.select();
            } else if (e.key === 'Enter' || e.key === 'F3') {
                await this.findNext(e);
                e.preventDefault();
                return false;
            } else if (e.key === 'Escape') {
                await this.getHandler().close();
            }
        });

        this.$input.on('input', () => this.startSearch());

        // Note blur doesn't bubble to parent div, but the parent div needs to
        // detect when any of the children are not focused and hide. Use
        // focusout instead which does bubble to the parent div.
        this.$findBox.on('focusout', async e => {
            // e.relatedTarget is the new focused element, note it can be null
            // if nothing is being focused
            if (this.$findBox[0].contains(e.relatedTarget)) {
                // The focused element is inside this div, ignore
                return;
            }

            await this.closeSearch();
        });

        return this.$widget;
    }

    startSearch() {
        // XXX This should clear the previous search immediately in all cases
        //     (the search is stale when waitforenter but also while the
        //     delay is running for non waitforenter case)
        if (!waitForEnter) {
            // Clear the previous timeout if any, it's ok if timeoutId is
            // null or undefined
            clearTimeout(this.timeoutId);

            // Defer the search a few millis so the search doesn't start
            // immediately, as this can cause search word typing lag with
            // one or two-char searchwords and long notes
            // See https://github.com/antoniotejada/Trilium-FindWidget/issues/1
            const searchTerm = this.$input.val();
            const matchCase = this.$caseSensitiveCheckbox.prop("checked");
            const wholeWord = this.$matchWordsCheckbox.prop("checked");
            this.timeoutId = setTimeout(async () => {
                this.timeoutId = null;
                await this.performFind(searchTerm, matchCase, wholeWord);
            }, findWidgetDelayMillis);
        }
    }

    async findNext(e) {
        const searchTerm = this.$input.val();
        if (waitForEnter && this.searchTerm !== searchTerm) {
            await this.performFind(searchTerm);
        }
        const totalFound = parseInt(this.$totalFound.text());
        const currentFound = parseInt(this.$currentFound.text()) - 1;

        if (totalFound > 0) {
            const direction = e.shiftKey ? -1 : 1;
            let nextFound = currentFound + direction;
            // Wrap around
            if (nextFound > totalFound - 1) {
                nextFound = 0;
            } else if (nextFound < 0) {
                nextFound = totalFound - 1;
            }

            this.$currentFound.text(nextFound + 1);

            await this.getHandler().findNext(direction, currentFound, nextFound);
        }
    }

    async findInTextEvent() {
        const note = appContext.tabManager.getActiveContextNote();
        // Only writeable text and code supported
        const readOnly = note.getAttribute("label", "readOnly");
        if (!readOnly && (note.type === "code" || note.type === "text")) {
            if (this.$findBox.is(":hidden")) {
                this.$findBox.show();
                this.$input.focus();
                this.$totalFound.text(0);
                this.$currentFound.text(0);

                const searchTerm = await this.getHandler().getInitialSearchTerm();

                this.$input.val(searchTerm || "");

                // Directly perform the search if there's some text to
                // find, without delaying or waiting for enter
                if (searchTerm !== "") {
                    this.$input.select();
                    await this.performFind(searchTerm);
                }
            }
        }
    }

    /**
     * Perform the find and highlight the find results.
     *
     * @param [searchTerm] {string} taken from the input box if missing.
     * @param [matchCase] {boolean} taken from the checkbox state if missing.
     * @param [wholeWord] {boolean} taken from the checkbox state if missing.
     */
    async performFind(searchTerm, matchCase, wholeWord) {
        searchTerm = (searchTerm === undefined) ? this.$input.val() : searchTerm;
        matchCase = (matchCase === undefined) ? this.$caseSensitiveCheckbox.prop("checked") : matchCase;
        wholeWord = (wholeWord === undefined) ? this.$matchWordsCheckbox.prop("checked") : wholeWord;

        const {totalFound, currentFound} = await this.getHandler().performFind(searchTerm, matchCase, wholeWord);

        this.$totalFound.text(totalFound);
        this.$currentFound.text(currentFound);

        this.searchTerm = searchTerm;
    }

    async closeSearch() {
        this.$findBox.hide();

        // Restore any state, if there's a current occurrence clear markers
        // and scroll to and select the last occurrence

        // XXX Switching to a different tab with crl+tab doesn't invoke
        //     blur and leaves a stale search which then breaks when
        //     navigating it
        const totalFound = parseInt(this.$totalFound.text());
        const currentFound = parseInt(this.$currentFound.text()) - 1;

        if (totalFound > 0) {
            await this.getHandler().cleanup(totalFound, currentFound);
        }

        this.searchTerm = null;
    }

    isEnabled() {
        return super.isEnabled() && (this.note.type === 'text' || this.note.type === 'code');
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteContentReloaded(this.noteId)) {
            this.refresh();
        }
    }

    getHandler() {
        const note = appContext.tabManager.getActiveContextNote();

        if (note.type === "code") {
            return this.codeHandler;
        } else {
            return this.textHandler;
        }
    }
}
