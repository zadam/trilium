/**
 * (c) Antonio Tejada 2022
 * https://github.com/antoniotejada/Trilium-FindWidget
 */

import NoteContextAwareWidget from "./note_context_aware_widget.js";
import FindInText from "./find_in_text.js";
import FindInCode from "./find_in_code.js";
import FindInHtml from "./find_in_html.js";

const findWidgetDelayMillis = 200;
const waitForEnter = (findWidgetDelayMillis < 0);

// tabIndex=-1 on the checkbox labels is necessary, so when clicking on the label,
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
        
        .find-widget-search-term-input-group {
            max-width: 300px;
        }
        
        .find-widget-spacer {
            flex-grow: 1;
        }
    </style>

    <div class="find-widget-box">
        <div class="input-group find-widget-search-term-input-group">
            <input type="text" class="form-control find-widget-search-term-input">
            <div class="input-group-append">
                <button class="btn btn-outline-secondary bx bxs-chevron-up find-widget-previous-button" type="button"></button>
                <button class="btn btn-outline-secondary bx bxs-chevron-down find-widget-next-button" type="button"></button>
            </div>
        </div>
        
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
        
        <div class="find-widget-spacer"></div>
        
        <div class="find-widget-close-button"><button class="btn icon-action bx bx-x"></button></div>
    </div>
</div>`;

export default class FindWidget extends NoteContextAwareWidget {
    constructor() {
        super();

        this.searchTerm = null;

        this.textHandler = new FindInText(this);
        this.codeHandler = new FindInCode(this);
        this.htmlHandler = new FindInHtml(this);
    }

    async noteSwitched() {
        await super.noteSwitched();

        await this.closeSearch();
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
        this.$previousButton = this.$widget.find(".find-widget-previous-button");
        this.$previousButton.on("click", () => this.findNext(-1));
        this.$nextButton = this.$widget.find(".find-widget-next-button");
        this.$nextButton.on("click", () => this.findNext(1));
        this.$closeButton = this.$widget.find(".find-widget-close-button");
        this.$closeButton.on("click", () => this.closeSearch());

        this.$input.keydown(async e => {
            if ((e.metaKey || e.ctrlKey) && (e.key === 'F' || e.key === 'f')) {
                // If ctrl+f is pressed when the findbox is shown, select the
                // whole input to find
                this.$input.select();
            } else if (e.key === 'Enter' || e.key === 'F3') {
                await this.findNext(e?.shiftKey ? -1 : 1);
                e.preventDefault();
                return false;
            }
        });

        this.$findBox.keydown(async e => {
            if (e.key === 'Escape') {
                await this.closeSearch();
            }
        });

        this.$input.on('input', () => this.startSearch());

        return this.$widget;
    }

    async findInTextEvent() {
        if (!this.isActiveNoteContext()) {
            return;
        }

        if (!['text', 'code', 'render'].includes(this.note.type)) {
            return;
        }

        this.handler = await this.getHandler();

        const selectedText = window.getSelection().toString() || "";

        this.$findBox.show();
        this.$input.focus();

        const isAlreadyVisible = this.$findBox.is(":visible");

        if (isAlreadyVisible) {
            if (selectedText) {
                this.$input.val(selectedText);
            }

            if (this.$input.val()) {
                await this.performFind();
            }

            this.$input.select();
        } else {
            this.$totalFound.text(0);
            this.$currentFound.text(0);
            this.$input.val(selectedText);

            if (selectedText) {
                this.$input.select();
                await this.performFind();
            }
        }
    }

    async getHandler() {
        if (this.note.type === 'render') {
            return this.htmlHandler;
        }

        const readOnly = await this.noteContext.isReadOnly();

        if (readOnly) {
            return this.htmlHandler;
        } else {
            return this.note.type === "code"
                ? this.codeHandler
                : this.textHandler;
        }
    }

    startSearch() {
        // XXX This should clear the previous search immediately in all cases
        //     (the search is stale when waitforenter but also while the
        //     delay is running for the non waitforenter case)
        if (!waitForEnter) {
            // Clear the previous timeout if any, it's ok if timeoutId is
            // null or undefined
            clearTimeout(this.timeoutId);

            // Defer the search a few millis so the search doesn't start
            // immediately, as this can cause search word typing lag with
            // one or two-char searchwords and long notes
            // See https://github.com/antoniotejada/Trilium-FindWidget/issues/1
            this.timeoutId = setTimeout(async () => {
                this.timeoutId = null;
                await this.performFind();
            }, findWidgetDelayMillis);
        }
    }

    /**
     * @param direction +1 for next, -1 for previous
     * @returns {Promise<void>}
     */
    async findNext(direction) {
        const searchTerm = this.$input.val();
        if (waitForEnter && this.searchTerm !== searchTerm) {
            await this.performFind();
        }
        const totalFound = parseInt(this.$totalFound.text());
        const currentFound = parseInt(this.$currentFound.text()) - 1;

        if (totalFound > 0) {
            let nextFound = currentFound + direction;
            // Wrap around
            if (nextFound > totalFound - 1) {
                nextFound = 0;
            } else if (nextFound < 0) {
                nextFound = totalFound - 1;
            }

            this.$currentFound.text(nextFound + 1);

            await this.handler.findNext(direction, currentFound, nextFound);
        }
    }

    /** Perform the find and highlight the find results. */
    async performFind() {
        const searchTerm = this.$input.val();
        const matchCase = this.$caseSensitiveCheckbox.prop("checked");
        const wholeWord = this.$matchWordsCheckbox.prop("checked");

        const {totalFound, currentFound} = await this.handler.performFind(searchTerm, matchCase, wholeWord);

        this.$totalFound.text(totalFound);
        this.$currentFound.text(currentFound);

        this.searchTerm = searchTerm;
    }

    async closeSearch() {
        if (this.$findBox.is(":visible")) {
            this.$findBox.hide();

            // Restore any state, if there's a current occurrence clear markers
            // and scroll to and select the last occurrence
            const totalFound = parseInt(this.$totalFound.text());
            const currentFound = parseInt(this.$currentFound.text()) - 1;

            this.searchTerm = null;

            await this.handler.findBoxClosed(totalFound, currentFound);
        }
    }

    isEnabled() {
        return super.isEnabled() && ['text', 'code', 'render'].includes(this.note.type);
    }
}
