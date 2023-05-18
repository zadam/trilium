// ck-find-result and ck-find-result_selected are the styles ck-editor
// uses for highlighting matches, use the same one on CodeMirror
// for consistency
import utils from "../services/utils.js";

const FIND_RESULT_SELECTED_CSS_CLASSNAME = "ck-find-result_selected";
const FIND_RESULT_CSS_CLASSNAME = "ck-find-result";

export default class FindInCode {
    constructor(parent) {
        /** @property {FindWidget} */
        this.parent = parent;
    }

    async getCodeEditor() {
        return this.parent.noteContext.getCodeEditor();
    }

    async performFind(searchTerm, matchCase, wholeWord) {
        let findResult = null;
        let totalFound = 0;
        let currentFound = -1;

        // See https://codemirror.net/addon/search/searchcursor.js for tips
        const codeEditor = await this.getCodeEditor();
        const doc = codeEditor.doc;
        const text = doc.getValue();

        // Clear all markers
        if (this.findResult != null) {
            codeEditor.operation(() => {
                for (let i = 0; i < this.findResult.length; ++i) {
                    const marker = this.findResult[i];
                    marker.clear();
                }
            });
        }

        if (searchTerm !== "") {
            searchTerm = utils.escapeRegExp(searchTerm);

            // Find and highlight matches
            // Find and highlight matches
            // XXX Using \\b and not using the unicode flag probably doesn't
            //     work with non ascii alphabets, findAndReplace uses a more
            //     complicated regexp, see
            //     https://github.com/ckeditor/ckeditor5/blob/b95e2faf817262ac0e1e21993d9c0bde3f1be594/packages/ckeditor5-find-and-replace/src/utils.js#L145
            const wholeWordChar = wholeWord ? "\\b" : "";
            const re = new RegExp(wholeWordChar + searchTerm + wholeWordChar,
                'g' + (matchCase ? '' : 'i'));
            let curLine = 0;
            let curChar = 0;
            let curMatch = null;
            findResult = [];
            // All those markText take several seconds on e.g. this ~500-line
            // script, batch them inside an operation, so they become
            // unnoticeable. Alternatively, an overlay could be used, see
            // https://codemirror.net/addon/search/match-highlighter.js ?
            codeEditor.operation(() => {
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
                    if (i === curMatch.index) {
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
                        if (currentFound === -1) {
                            const cursorPos = codeEditor.getCursor();
                            if ((fromPos.line > cursorPos.line) ||
                                ((fromPos.line === cursorPos.line) &&
                                    (fromPos.ch >= cursorPos.ch))){
                                currentFound = totalFound;
                            }
                        }

                        totalFound++;
                    }
                    // Do line and char position tracking
                    if (text[i] === "\n") {
                        curLine++;
                        curChar = 0;
                    } else {
                        curChar++;
                    }
                }
            });
        }

        this.findResult = findResult;

        // Calculate curfound if not already, highlight it as selected
        if (totalFound > 0) {
            currentFound = Math.max(0, currentFound)
            let marker = findResult[currentFound];
            let pos = marker.find();
            codeEditor.scrollIntoView(pos.to);
            marker.clear();
            findResult[currentFound] = doc.markText( pos.from, pos.to,
                { "className" : FIND_RESULT_SELECTED_CSS_CLASSNAME }
            );
        }

        return {
            totalFound,
            currentFound: currentFound + 1
        };
    }

    async findNext(direction, currentFound, nextFound) {
        const codeEditor = await this.getCodeEditor();
        const doc = codeEditor.doc;

        //
        // Dehighlight current, highlight & scrollIntoView next
        //

        let marker = this.findResult[currentFound];
        let pos = marker.find();
        marker.clear();
        marker = doc.markText(
            pos.from, pos.to,
            { "className" : FIND_RESULT_CSS_CLASSNAME }
        );
        this.findResult[currentFound] = marker;

        marker = this.findResult[nextFound];
        pos = marker.find();
        marker.clear();
        marker = doc.markText(
            pos.from, pos.to,
            { "className" : FIND_RESULT_SELECTED_CSS_CLASSNAME }
        );
        this.findResult[nextFound] = marker;

        codeEditor.scrollIntoView(pos.from);
    }

    async findBoxClosed(totalFound, currentFound) {
        const codeEditor = await this.getCodeEditor();

        if (totalFound > 0) {
            const doc = codeEditor.doc;
            const pos = this.findResult[currentFound].find();
            // Note setting the selection sets the cursor to
            // the end of the selection and scrolls it into
            // view
            doc.setSelection(pos.from, pos.to);
            // Clear all markers
            codeEditor.operation(() => {
                for (let i = 0; i < this.findResult.length; ++i) {
                    let marker = this.findResult[i];
                    marker.clear();
                }
            });
        }
        // Restore the highlightSelectionMatches setting
        codeEditor.setOption("highlightSelectionMatches", this.oldHighlightSelectionMatches);
        this.findResult = null;

        codeEditor.focus();
    }
}
