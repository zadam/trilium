/**
 * Find in note replacement for Trilium ctrl+f search
 * (c) Antonio Tejada 2022
 *
 * Features:
 * - Find in writeable using ctrl+f and F3
 * - Tested on Trilium Desktop 0.50.3
 *
 * Installation:
 * - Create a code note of language JS Frontend with the contents of this file
 * - Set the owned attributes (alt-a) to #widget
 * - Set the owned attributes of any note you don't want to enable finding to
 *   #noFindWidget
 * - Disable Ctrl+f shorcut in Trilium options
 *
 * Todo:
 * - Refactoring/code cleanup
 * - Case-sensitive option
 * - Regexp option
 * - Full word option
 * - Find & Replace
 *
 * Note that many times some common code is replicated between CodeMirror and
 * CKEditor codepaths because the CKEditor update is done inside a callback that
 * is deferred so the code cannot be put outside of the callback or it will
 * execute too early.
 *
 * See https://github.com/zadam/trilium/discussions/2806 for discussions
 */

import NoteContextAwareWidget from "./note_context_aware_widget.js";
import appContext from "../services/app_context.js";

function getNoteAttributeValue(note, attributeType, attributeName, defaultValue) {
    let attribute = note.getAttribute(attributeType, attributeName);

    let attributeValue = (attribute != null) ? attribute.value : defaultValue;

    return attributeValue;
}

const findWidgetDelayMillis = 200;
const waitForEnter = (findWidgetDelayMillis < 0);

// tabIndex=-1 on the checkbox labels is necessary so when clicking on the label
// the focusout handler is called with relatedTarget equal to the label instead
// of undefined. It's -1 instead of > 0 so they don't tabstop
const TEMPLATE = `<div style="contain: none;">
<div id="findBox" style="padding: 10px; border-top: 1px solid var(--main-border-color); ">
    <input type="text" id="input">
    <label tabIndex="-1" id="caseLabel"><input type="checkbox" id="caseCheck"> case</label>
    <label tabIndex="-1" id="wordLabel"><input type="checkbox" id="wordCheck"> word</label>
    <label tabIndex="-1" id="regexpLabel"><input type="checkbox" id="regexpCheck" disabled> regexp</label>
    <span style="font-weight: bold;" id="curFound">0</span>/<span style="font-weight: bold;" id="numFound">0</span>
</div>
</div>`;

const tag = "FindWidget";
const debugLevels = ["error", "warn", "info", "log", "debug"];
const debugLevel = "info";

let warn = function() {};
if (debugLevel >= debugLevels.indexOf("warn")) {
    warn = console.warn.bind(console, tag + ": ");
}

let info = function() {};
if (debugLevel >= debugLevels.indexOf("info")) {
    info = console.info.bind(console, tag + ": ");
}

let log = function() {};
if (debugLevel >= debugLevels.indexOf("log")) {
    log = console.log.bind(console, tag + ": ");
}

let dbg = function() {};
if (debugLevel >= debugLevels.indexOf("debug")) {
    dbg = console.debug.bind(console, tag + ": ");
}

function assert(e, msg) {
    console.assert(e, tag + ": " + msg);
}

function debugbreak() {
    debugger;
}


function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getActiveContextCodeEditor() {
    return await appContext.tabManager.getActiveContextCodeEditor();
}

async function getActiveContextTextEditor() {
    return await appContext.tabManager.getActiveContextTextEditor();
}

// ck-find-result and ck-find-result_selected are the styles ck-editor
// uses for highlighting matches, use the same one on CodeMirror
// for consistency
const FIND_RESULT_SELECTED_CSS_CLASSNAME = "ck-find-result_selected";
const FIND_RESULT_CSS_CLASSNAME = "ck-find-result";

export default class FindWidget extends NoteContextAwareWidget {
    constructor(...args) {
        super(...args);
        this.$widget = $(TEMPLATE);
        this.$findBox = this.$widget.find('#findBox');
        this.$input = this.$widget.find('#input');
        this.$curFound = this.$widget.find('#curFound');
        this.$numFound = this.$widget.find('#numFound');
        this.$caseCheck = this.$widget.find("#caseCheck");
        this.$wordCheck = this.$widget.find("#wordCheck");
        this.findResult = null;
        this.prevFocus = null;
        this.needle = null;
        let findWidget = this;

        // XXX Use api.bindGlobalShortcut?
        $(window).keydown(async function (e){
            dbg("keydown on window " + e.key);
            if ((e.key == 'F3') ||
                // Note that for ctrl+f to work, needs to be disabled in Trilium's
                // shortcut config menu
                // XXX Maybe not if using bindShorcut?
                ((e.metaKey || e.ctrlKey) && ((e.key == 'f') || (e.key == 'F')))) {

                const note = appContext.tabManager.getActiveContextNote();
                // Only writeable text and code supported
                const readOnly = note.getAttribute("label", "readOnly");
                if (!readOnly && ((note.type == "code") || (note.type == "text"))) {
                    if (findWidget.$findBox.is(":hidden")) {

                        findWidget.$findBox.show();
                        findWidget.$input.focus();
                        findWidget.$numFound.text(0);
                        findWidget.$curFound.text(0);

                        // Initialize the input field to the text selection, if any
                        if (note.type == "code") {
                            let codeEditor = getActiveContextCodeEditor();

                            // highlightSelectionMatches is the overlay that highlights
                            // the words under the cursor. This occludes the search
                            // markers style, save it, disable it. Will be restored when
                            // the focus is back into the note
                            findWidget.oldHighlightSelectionMatches = codeEditor.getOption("highlightSelectionMatches");
                            codeEditor.setOption("highlightSelectionMatches", false);

                            // Fill in the findbox with the current selection if any
                            const selectedText = codeEditor.getSelection()
                            if (selectedText != "") {
                                findWidget.$input.val(selectedText);
                            }
                            // Directly perform the search if there's some text to find,
                            // without delaying or waiting for enter
                            const needle = findWidget.$input.val();
                            if (needle != "") {
                                findWidget.$input.select();
                                await findWidget.performFind(needle);
                            }
                        } else {
                            const textEditor = await getActiveContextTextEditor();

                            const selection = textEditor.model.document.selection;
                            const range = selection.getFirstRange();

                            for (const item of range.getItems()) {
                                // Fill in the findbox with the current selection if
                                // any
                                findWidget.$input.val(item.data);
                                break;
                            }
                            // Directly perform the search if there's some text to
                            // find, without delaying or waiting for enter
                            const needle = findWidget.$input.val();
                            if (needle != "") {
                                findWidget.$input.select();
                                await findWidget.performFind(needle);
                            }
                        }
                    }
                    e.preventDefault();
                    return false;
                }
            }
            return true;
        });

        findWidget.$input.keydown(async function (e) {
            dbg("keydown on input " + e.key);
            if ((e.metaKey || e.ctrlKey) && ((e.key == 'F') || (e.key == 'f'))) {
                // If ctrl+f is pressed when the findbox is shown, select the
                // whole input to find
                findWidget.$input.select();
            } else if ((e.key == 'Enter') || (e.key == 'F3')) {
                const needle = findWidget.$input.val();
                if (waitForEnter && (findWidget.needle != needle)) {
                    await findWidget.performFind(needle);
                }
                let numFound = parseInt(findWidget.$numFound.text());
                let curFound = parseInt(findWidget.$curFound.text()) - 1;
                dbg("Finding " + curFound + "/" + numFound + " occurrence of " + findWidget.$input.val());
                if (numFound > 0) {
                    let delta =  e.shiftKey ? -1 : 1;
                    let nextFound = curFound + delta;
                    // Wrap around
                    if (nextFound > numFound - 1) {
                        nextFound = 0;
                    } if (nextFound < 0) {
                        nextFound = numFound - 1;
                    }

                    let needle = findWidget.$input.val();
                    findWidget.$curFound.text(nextFound + 1);

                    const note = appContext.tabManager.getActiveContextNote();
                    if (note.type == "code") {
                        let codeEditor = getActiveContextCodeEditor();
                        let doc = codeEditor.doc;

                        //
                        // Dehighlight current, highlight & scrollIntoView next
                        //

                        let marker = findWidget.findResult[curFound];
                        let pos = marker.find();
                        marker.clear();
                        marker = doc.markText(
                            pos.from, pos.to,
                            { "className" : FIND_RESULT_CSS_CLASSNAME }
                        );
                        findWidget.findResult[curFound] = marker;

                        marker = findWidget.findResult[nextFound];
                        pos = marker.find();
                        marker.clear();
                        marker = doc.markText(
                            pos.from, pos.to,
                            { "className" : FIND_RESULT_SELECTED_CSS_CLASSNAME }
                        );
                        findWidget.findResult[nextFound] = marker;

                        codeEditor.scrollIntoView(pos.from);
                    } else {
                        assert(note.type == "text", "Expected text note, found " + note.type);
                        const textEditor = await getActiveContextTextEditor();

                        // There are no parameters for findNext/findPrev
                        // See https://github.com/ckeditor/ckeditor5/blob/b95e2faf817262ac0e1e21993d9c0bde3f1be594/packages/ckeditor5-find-and-replace/src/findnextcommand.js#L57
                        // curFound wrap around above assumes findNext and
                        // findPrevious wraparound, which is what they do
                        if (delta > 0) {
                            textEditor.execute('findNext');
                        } else {
                            textEditor.execute('findPrevious');
                        }
                    }
                }
                e.preventDefault();
                return false;
            } else if (e.key == 'Escape') {
                let numFound = parseInt(findWidget.$numFound.text());

                const note = appContext.tabManager.getActiveContextNote();
                if (note.type == "code") {
                    let codeEditor = getActiveContextCodeEditor();

                    codeEditor.focus();
                } else {
                    assert(note.type == "text", "Expected text note, found " + note.type);
                    const textEditor = await getActiveContextTextEditor();
                    textEditor.focus();
                }
            }
            // e.preventDefault();
        });

        findWidget.$input.on('input', function (e) {
            // XXX This should clear the previous search immediately in all cases
            //     (the search is stale when waitforenter but also while the
            //     delay is running for non waitforenter case)
            if (!waitForEnter) {
                // Clear the previous timeout if any, it's ok if timeoutId is
                // null or undefined
                clearTimeout(findWidget.timeoutId);

                // Defer the search a few millis so the search doesn't start
                // immediately, as this can cause search word typing lag with
                // one or two-char searchwords and long notes
                // See https://github.com/antoniotejada/Trilium-FindWidget/issues/1
                const needle = findWidget.$input.val();
                const matchCase = findWidget.$caseCheck.prop("checked");
                const wholeWord = findWidget.$wordCheck.prop("checked");
                findWidget.timeoutId = setTimeout(async function () {
                    findWidget.timeoutId = null;
                    await findWidget.performFind(needle, matchCase, wholeWord);
                }, findWidgetDelayMillis);
            }
        });

        findWidget.$caseCheck.change(function() {
            log("caseCheck change");
            findWidget.performFind();
        });

        findWidget.$wordCheck.change(function() {
            log("wordCheck change");
            findWidget.performFind();
        });

        // Note blur doesn't bubble to parent div, but the parent div needs to
        // detect when any of the children are not focused and hide. Use
        // focusout instead which does bubble to the parent div.
        findWidget.$findBox.focusout(async function (e) {
            // e.relatedTarget is the new focused element, note it can be null
            // if nothing is being focused
            log(`focusout ${e.target.id} related ${e.relatedTarget?.id}`);
            if (findWidget.$findBox[0].contains(e.relatedTarget)) {
                // The focused element is inside this div, ignore
                log("focusout to child, ignoring");
                return;
            }
            findWidget.$findBox.hide();

            // Restore any state, if there's a current occurrence clear markers
            // and scroll to and select the last occurrence

            // XXX Switching to a different tab with crl+tab doesn't invoke
            //     blur and leaves a stale search which then breaks when
            //     navigating it
            let numFound = parseInt(findWidget.$numFound.text());
            let curFound = parseInt(findWidget.$curFound.text()) - 1;
            const note = appContext.tabManager.getActiveContextNote();
            if (note.type == "code") {
                let codeEditor = await getActiveContextCodeEditor();
                if (numFound > 0) {
                    let doc = codeEditor.doc;
                    let pos = findWidget.findResult[curFound].find();
                    // Note setting the selection sets the cursor to
                    // the end of the selection and scrolls it into
                    // view
                    doc.setSelection(pos.from, pos.to);
                    // Clear all markers
                    codeEditor.operation(function() {
                        for (let i = 0; i < findWidget.findResult.length; ++i) {
                            let marker = findWidget.findResult[i];
                            marker.clear();
                        }
                    });
                }
                // Restore the highlightSelectionMatches setting
                codeEditor.setOption("highlightSelectionMatches", findWidget.oldHighlightSelectionMatches);
                findWidget.findResult = null;
                findWidget.needle = null;
            } else {
                assert(note.type == "text", "Expected text note, found " + note.type);
                if (numFound > 0) {
                    const textEditor = await getActiveContextTextEditor();
                    // Clear the markers and set the caret to the
                    // current occurrence
                    const model = textEditor.model;
                    let range = findWidget.findResult.results.get(curFound).marker.getRange();
                    // From
                    // https://github.com/ckeditor/ckeditor5/blob/b95e2faf817262ac0e1e21993d9c0bde3f1be594/packages/ckeditor5-find-and-replace/src/findandreplace.js#L92
                    // XXX Roll our own since already done for codeEditor and
                    //     will probably allow more refactoring?
                    let findAndReplaceEditing = textEditor.plugins.get('FindAndReplaceEditing');
                    findAndReplaceEditing.state.clear(model);
                    findAndReplaceEditing.stop();
                    model.change(writer => {
                        writer.setSelection(range, 0);
                    });
                    textEditor.editing.view.scrollToTheSelection();
                    findWidget.findResult = null;
                    findWidget.needle = null;
                } else {
                    findWidget.findResult = null;
                    findWidget.needle = null;
                }
            }
        });
    }

    async performTextNoteFind(needle, matchCase, wholeWord) {
        // Do this even if the needle is empty so the markers are cleared and
        // the counters updated
        const textEditor = await getActiveContextTextEditor();
        const model = textEditor.model;
        let findResult = null;
        let numFound = 0;
        let curFound = -1;

        // Clear
        let findAndReplaceEditing = textEditor.plugins.get('FindAndReplaceEditing');
        log("findAndReplace clearing");
        findAndReplaceEditing.state.clear(model);
        log("findAndReplace stopping");
        findAndReplaceEditing.stop();
        if (needle != "") {
            // Parameters are callback/text, options.matchCase=false, options.wholeWords=false
            // See https://github.com/ckeditor/ckeditor5/blob/b95e2faf817262ac0e1e21993d9c0bde3f1be594/packages/ckeditor5-find-and-replace/src/findcommand.js#L44
            // XXX Need to use the callback version for regexp
            // needle = escapeRegExp(needle);
            // let re = new RegExp(needle, 'gi');
            // let m = text.match(re);
            // numFound = m ? m.length : 0;
            log("findAndReplace starts");
            const options = { "matchCase" : matchCase, "wholeWords" : wholeWord };
            findResult = textEditor.execute('find', needle, options);
            log("findAndReplace ends");
            numFound = findResult.results.length;
            // Find the result beyond the cursor
            log("findAndReplace positioning");
            let cursorPos = model.document.selection.getLastPosition();
            for (let i = 0; i < findResult.results.length; ++i) {
                let marker = findResult.results.get(i).marker;
                let fromPos = marker.getStart();
                if (fromPos.compareWith(cursorPos) != "before") {
                    curFound = i;
                    break;
                }
            }
            log("findAndReplace positioned");
        }

        this.findResult = findResult;
        this.$numFound.text(numFound);
        // Calculate curfound if not already, highlight it as
        // selected
        if (numFound > 0) {
            curFound = Math.max(0, curFound);
            // XXX Do this accessing the private data?
            // See
            // https://github.com/ckeditor/ckeditor5/blob/b95e2faf817262ac0e1e21993d9c0bde3f1be594/packages/ckeditor5-find-and-replace/src/findnextcommand.js
            for (let i = 0 ; i < curFound; ++i) {
                textEditor.execute('findNext', needle);
            }
        }
        this.$curFound.text(curFound + 1);
        this.needle = needle;
    }

    async performCodeNoteFind(needle, matchCase, wholeWord) {
        let findResult = null;
        let numFound = 0;
        let curFound = -1;

        // See https://codemirror.net/addon/search/searchcursor.js for tips
        let codeEditor = await getActiveContextCodeEditor();
        let doc = codeEditor.doc;
        let text = doc.getValue();

        // Clear all markers
        if (this.findResult != null) {
            const findWidget = this;
            codeEditor.operation(function() {
                for (let i = 0; i < findWidget.findResult.length; ++i) {
                    let marker = findWidget.findResult[i];
                    marker.clear();
                }
            });
        }

        if (needle != "") {
            needle = escapeRegExp(needle);

            // Find and highlight matches
            // Find and highlight matches
            // XXX Using \\b and not using the unicode flag probably doesn't
            //     work with non ascii alphabets, findAndReplace uses a more
            //     complicated regexp, see
            //     https://github.com/ckeditor/ckeditor5/blob/b95e2faf817262ac0e1e21993d9c0bde3f1be594/packages/ckeditor5-find-and-replace/src/utils.js#L145
            const wholeWordChar = wholeWord ? "\\b" : "";
            let re = new RegExp(wholeWordChar + needle + wholeWordChar,
                'g' + (matchCase ? '' : 'i'));
            let curLine = 0;
            let curChar = 0;
            let curMatch = null;
            findResult = [];
            // All those markText take several seconds on eg this ~500-line
            // script, batch them inside an operation so they become
            // unnoticeable. Alternatively, an overlay could be used, see
            // https://codemirror.net/addon/search/match-highlighter.js ?
            codeEditor.operation(function() {
                for (let i = 0; i < text.length; ++i) {
                    // Fetch next match if it's the first time or
                    // if past the current match start
                    if ((curMatch == null) || (curMatch.index < i)) {
                        curMatch = re.exec(text);
                        if (curMatch == null) {
                            // No more matches
                            break;
                        }
                    }
                    // Create a non-selected highlight marker for the match, the
                    // selected marker highlight will be done later
                    if (i == curMatch.index) {
                        let fromPos = { "line" : curLine, "ch" : curChar };
                        // XXX If multiline is supported, this needs to
                        //     recalculate curLine since the match may span
                        //     lines
                        let toPos = { "line" : curLine, "ch" : curChar + curMatch[0].length};
                        // XXX or css = "color: #f3"
                        let marker = doc.markText( fromPos, toPos, { "className" : FIND_RESULT_CSS_CLASSNAME });
                        findResult.push(marker);

                        // Set the first match beyond the cursor as current
                        // match
                        if (curFound == -1) {
                            let cursorPos = codeEditor.getCursor();
                            if ((fromPos.line > cursorPos.line) ||
                                ((fromPos.line == cursorPos.line) &&
                                    (fromPos.ch >= cursorPos.ch))){
                                curFound = numFound;
                            }
                        }

                        numFound++;
                    }
                    // Do line and char position tracking
                    if (text[i] == "\n") {
                        curLine++;
                        curChar = 0;
                    } else {
                        curChar++;
                    }
                }
            });
        }

        this.findResult = findResult;
        this.$numFound.text(numFound);
        // Calculate curfound if not already, highlight it as selected
        if (numFound > 0) {
            curFound = Math.max(0, curFound)
            let marker = findResult[curFound];
            let pos = marker.find();
            codeEditor.scrollIntoView(pos.to);
            marker.clear();
            findResult[curFound] = doc.markText( pos.from, pos.to,
                { "className" : FIND_RESULT_SELECTED_CSS_CLASSNAME }
            );
        }
        this.$curFound.text(curFound + 1);
        this.needle = needle;
    }

    /**
     * Perform the find and highlight the find results.
     *
     * @param needle {string} optional parameter, taken from the input box if
     *        missing.
     * @param matchCase {boolean} optional parameter, taken from the checkbox
     *        state if missing.
     * @param wholeWord {boolean} optional parameter, taken from the checkbox
     *        state if missing.
     */
    async performFind(needle, matchCase, wholeWord) {
        needle = (needle == undefined) ? this.$input.val() : needle;
        matchCase = (matchCase === undefined) ? this.$caseCheck.prop("checked") : matchCase;
        wholeWord = (wholeWord === undefined) ? this.$wordCheck.prop("checked") : wholeWord;
        log(`performFind needle:${needle} case:${matchCase} word:${wholeWord}`);
        const note = appContext.tabManager.getActiveContextNote();
        if (note.type == "code") {
            await this.performCodeNoteFind(needle, matchCase, wholeWord);
        } else {
            assert(note.type == "text", "Expected text note, found " + note.type);
            await this.performTextNoteFind(needle, matchCase, wholeWord);
        }
    }

    isEnabled() {
        dbg("isEnabled");
        return super.isEnabled()
            && ((this.note.type === 'text') || (this.note.type === 'code'))
            && !this.note.hasLabel('noFindWidget');
    }

    doRender() {
        dbg("doRender");
        this.$findBox.hide();
        return this.$widget;
    }

    async refreshWithNote(note) {
        dbg("refreshWithNote");
    }

    async entitiesReloadedEvent({loadResults}) {
        dbg("entitiesReloadedEvent");
        if (loadResults.isNoteContentReloaded(this.noteId)) {
            this.refresh();
        }
    }
}
