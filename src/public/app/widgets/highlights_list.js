/**
 * Widget: Show highlighted text in the right pane
 *
 * By design, there's no support for nonsensical or malformed constructs:
 * - For example, if there is a formula in the middle of the highlighted text, the two ends of the formula will be regarded as two entries
 */

import attributeService from "../services/attributes.js";
import RightPanelWidget from "./right_panel_widget.js";
import options from "../services/options.js";
import OnClickButtonWidget from "./buttons/onclick_button.js";

const TPL = `<div class="highlights-list-widget">
    <style>
        .highlights-list-widget {
            padding: 10px;
            contain: none; 
            overflow: auto;
            position: relative;
        }
        
        .highlights-list > ol {
            padding-left: 20px;
        }
        
        .highlights-list li {
            cursor: pointer;
            margin-bottom: 3px;
            text-align: justify;
            text-justify: distribute;
            word-wrap: break-word;
            hyphens: auto;
        }
        
        .highlights-list li:hover {
            font-weight: bold;
        }
        
        .close-highlights-list {
            position: absolute;
            top: 2px;
            right: 2px;
        }
    </style>

    <span class="highlights-list"></span>
</div>`;

export default class HighlightsListWidget extends RightPanelWidget {
    constructor() {
        super();

        this.closeHltButton = new CloseHltButton();
        this.child(this.closeHltButton);
    }

    get widgetTitle() {
        return "Highlights List";
    }

    isEnabled() {
        return super.isEnabled()
            && this.note.type === 'text'
            && !this.noteContext.viewScope.highlightsListTemporarilyHidden
            && this.noteContext.viewScope.viewMode === 'default';
    }

    async doRenderBody() {
        this.$body.empty().append($(TPL));
        this.$highlightsList = this.$body.find('.highlights-list');
        this.$body.find('.highlights-list-widget').append(this.closeHltButton.render());
    }

    async refreshWithNote(note) {
        /* The reason for adding highlightsListPreviousVisible is to record whether the previous state
           of the highlightsList is hidden or displayed, and then let it be displayed/hidden at the initial time.
           If there is no such value, when the right panel needs to display toc but not highlighttext,
           every time the note content is changed, highlighttext Widget will appear and then close immediately,
           because getHlt function will consume time */
        if (this.noteContext.viewScope.highlightsListPreviousVisible) {
            this.toggleInt(true);
        } else {
            this.toggleInt(false);
        }

        const optionsHighlightsList = JSON.parse(options.get('highlightsList'));

        if (note.isLabelTruthy('hideHighlightWidget') || !optionsHighlightsList) {
            this.toggleInt(false);
            this.triggerCommand("reEvaluateRightPaneVisibility");
            return;
        }

        let $highlightsList = "", hlLiCount = -1;
        // Check for type text unconditionally in case alwaysShowWidget is set
        if (this.note.type === 'text') {
            const {content} = await note.getNoteComplement();
            ({$highlightsList, hlLiCount} = this.getHighlightList(content, optionsHighlightsList));
        }
        this.$highlightsList.empty().append($highlightsList);
        if (hlLiCount > 0) {
            this.toggleInt(true);
            this.noteContext.viewScope.highlightsListPreviousVisible = true;
        } else {
            this.toggleInt(false);
            this.noteContext.viewScope.highlightsListPreviousVisible = false;
        }

        this.triggerCommand("reEvaluateRightPaneVisibility");
    }

    getHighlightList(content, optionsHighlightsList) {
        // matches a span containing background-color
        const regex1 = /<span[^>]*style\s*=\s*[^>]*background-color:[^>]*?>[\s\S]*?<\/span>/gi;
        // matches a span containing color
        const regex2 = /<span[^>]*style\s*=\s*[^>]*[^-]color:[^>]*?>[\s\S]*?<\/span>/gi;
        // match italics
        const regex3 = /<i>[\s\S]*?<\/i>/gi;
        // match bold
        const regex4 = /<strong>[\s\S]*?<\/strong>/gi;
        // match underline
        const regex5 = /<u>[\s\S]*?<\/u>/g;
        // Possible values in optionsHighlightsList： '["bold","italic","underline","color","bgColor"]'
        // element priority： span>i>strong>u
        let findSubStr = "", combinedRegexStr = "";
        if (optionsHighlightsList.includes("bgColor")) {
            findSubStr += `,span[style*="background-color"]:not(section.include-note span[style*="background-color"])`;
            combinedRegexStr += `|${regex1.source}`;
        }
        if (optionsHighlightsList.includes("color")) {
            findSubStr += `,span[style*="color"]:not(section.include-note span[style*="color"])`;
            combinedRegexStr += `|${regex2.source}`;
        }
        if (optionsHighlightsList.includes("italic")) {
            findSubStr += `,i:not(section.include-note i)`;
            combinedRegexStr += `|${regex3.source}`;
        }
        if (optionsHighlightsList.includes("bold")) {
            findSubStr += `,strong:not(section.include-note strong)`;
            combinedRegexStr += `|${regex4.source}`;
        }
        if (optionsHighlightsList.includes("underline")) {
            findSubStr += `,u:not(section.include-note u)`;
            combinedRegexStr += `|${regex5.source}`;
        }

        findSubStr = findSubStr.substring(1)
        combinedRegexStr = `(` + combinedRegexStr.substring(1) + `)`;
        const combinedRegex = new RegExp(combinedRegexStr, 'gi');
        const $highlightsList = $("<ol>");
        let prevEndIndex = -1, hlLiCount = 0;
        for (let match = null, hltIndex = 0; ((match = combinedRegex.exec(content)) !== null); hltIndex++) {
            const subHtml = match[0];
            const startIndex = match.index;
            const endIndex = combinedRegex.lastIndex;
            if (prevEndIndex !== -1 && startIndex === prevEndIndex) {
                // If the previous element is connected to this element in HTML, then concatenate them into one.
                $highlightsList.children().last().append(subHtml);
            } else {
                // TODO: can't be done with $(subHtml).text()?
                //Can’t remember why regular expressions are used here, but modified to $(subHtml).text() works as expected
                //const hasText = [...subHtml.matchAll(/(?<=^|>)[^><]+?(?=<|$)/g)].map(matchTmp => matchTmp[0]).join('').trim();
                const hasText = $(subHtml).text().trim();

                if (hasText) {
                    $highlightsList.append(
                        $('<li>')
                            .html(subHtml)
                            .on("click", () => this.jumpToHighlightsList(findSubStr, hltIndex))
                    );

                    hlLiCount++;
                } else {
                    // hide li if its text content is empty
                    continue;
                }
            }
            prevEndIndex = endIndex;
        }
        return {
            $highlightsList,
            hlLiCount
        };
    }

    async jumpToHighlightsList(findSubStr, itemIndex) {
        const isReadOnly = await this.noteContext.isReadOnly();
        let targetElement;
        if (isReadOnly) {
            const $container = await this.noteContext.getContentElement();
            targetElement = $container.find(findSubStr).filter(function () {
                if (findSubStr.indexOf("color") >= 0 && findSubStr.indexOf("background-color") < 0) {
                    let color = this.style.color;
                    return !($(this).prop('tagName') === "SPAN" && color === "");
                } else {
                    return true;
                }
            }).filter(function () {
                return $(this).parent(findSubStr).length === 0
                    && $(this).parent().parent(findSubStr).length === 0
                    && $(this).parent().parent().parent(findSubStr).length === 0
                    && $(this).parent().parent().parent().parent(findSubStr).length === 0;
            })
        } else {
            const textEditor = await this.noteContext.getTextEditor();
            targetElement = $(textEditor.editing.view.domRoots.values().next().value).find(findSubStr).filter(function () {
                // When finding span[style*="color"] but not looking for span[style*="background-color"],
                // the background-color error will be regarded as color, so it needs to be filtered
                if (findSubStr.indexOf("color") >= 0 && findSubStr.indexOf("background-color") < 0) {
                    let color = this.style.color;
                    return !($(this).prop('tagName') === "SPAN" && color === "");
                } else {
                    return true;
                }
            }).filter(function () {
                // Need to filter out the child elements of the element that has been found
                return $(this).parent(findSubStr).length === 0
                    && $(this).parent().parent(findSubStr).length === 0
                    && $(this).parent().parent().parent(findSubStr).length === 0
                    && $(this).parent().parent().parent().parent(findSubStr).length === 0;
            })
        }
        targetElement[itemIndex].scrollIntoView({
            behavior: "smooth", block: "center"
        });
    }

    async closeHltCommand() {
        this.noteContext.viewScope.highlightsListTemporarilyHidden = true;
        await this.refresh();
        this.triggerCommand('reEvaluateRightPaneVisibility');
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteContentReloaded(this.noteId)) {
            await this.refresh();
        } else if (loadResults.getAttributes().find(attr => attr.type === 'label'
            && (attr.name.toLowerCase().includes('readonly') || attr.name === 'hideHighlightWidget')
            && attributeService.isAffecting(attr, this.note))) {
            await this.refresh();
        }
    }
}

class CloseHltButton extends OnClickButtonWidget {
    constructor() {
        super();

        this.icon("bx-x")
            .title("Close HighlightsListWidget")
            .titlePlacement("bottom")
            .onClick((widget, e) => {
                e.stopPropagation();

                widget.triggerCommand("closeHlt");
            })
            .class("icon-action close-highlights-list");
    }
}
