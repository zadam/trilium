/**
 * Table of contents widget
 * (c) Antonio Tejada 2022
 *
 * By design, there's no support for nonsensical or malformed constructs:
 * - headings inside elements (e.g. Trilium allows headings inside tables, but
 *   not inside lists)
 * - nested headings when using raw HTML <H2><H3></H3></H2>
 * - malformed headings when using raw HTML <H2></H3></H2><H3>
 * - etc.
 *
 * In those cases, the generated TOC may be incorrect, or the navigation may lead
 * to the wrong heading (although what "right" means in those cases is not
 * clear), but it won't crash.
 */

import attributeService from "../services/attributes.js";
import RightPanelWidget from "./right_panel_widget.js";
import options from "../services/options.js";
import OnClickButtonWidget from "./buttons/onclick_button.js";

const TPL = `<div class="toc-widget">
    <style>
        .toc-widget {
            padding: 10px;
            contain: none; 
            overflow: auto;
            position: relative;
        }
        
        .toc ol {
            padding-left: 25px;
        }
        
        .toc > ol {
            padding-left: 20px;
        }
        
        .toc li {
            cursor: pointer;
            text-align: justify;
            text-justify: distribute;
            word-wrap: break-word;
            hyphens: auto;
        }
        
        .toc li:hover {
            font-weight: bold;
        }
        
        .close-toc {
            position: absolute;
            top: 2px;
            right: 0px;
        }
    </style>

    <span class="toc"></span>
</div>`;

export default class TocWidget extends RightPanelWidget {
    constructor() {
        super();

        this.closeTocButton = new CloseTocButton();
        this.child(this.closeTocButton);
    }

    get widgetTitle() {
        return "Table of Contents";
    }

    isEnabled() {
        return super.isEnabled()
            && this.note.type === 'text'
            && !this.noteContext.viewScope.tocTemporarilyHidden
            && this.noteContext.viewScope.viewMode === 'default';
    }

    async doRenderBody() {
        this.$body.empty().append($(TPL));
        this.$toc = this.$body.find('.toc');
        this.$body.find('.toc-widget').append(this.closeTocButton.render());
    }

    async refreshWithNote(note) {
        /*The reason for adding tocPreviousVisible is to record whether the previous state of the toc is hidden or displayed,
        * and then let it be displayed/hidden at the initial time. If there is no such value,
        * when the right panel needs to display highlighttext but not toc, every time the note content is changed,
        * toc will appear and then close immediately, because getToc(html) function will consume time*/
        this.toggleInt(!!this.noteContext.viewScope.tocPreviousVisible);

        const tocLabel = note.getLabel('toc');

        if (tocLabel?.value === 'hide') {
            this.toggleInt(false);
            this.triggerCommand("reEvaluateRightPaneVisibility");
            return;
        }

        let $toc = "", headingCount = 0;
        // Check for type text unconditionally in case alwaysShowWidget is set
        if (this.note.type === 'text') {
            const { content } = await note.getBlob();
            ({$toc, headingCount} = await this.getToc(content));
        }

        this.$toc.html($toc);
        if (["", "show"].includes(tocLabel?.value) || headingCount >= options.getInt('minTocHeadings')){
            this.toggleInt(true);
            this.noteContext.viewScope.tocPreviousVisible=true;
        }else{
            this.toggleInt(false);
            this.noteContext.viewScope.tocPreviousVisible=false;
        }

        this.triggerCommand("reEvaluateRightPaneVisibility");
    }

    /**
     * Builds a jquery table of contents.
     *
     * @param {string} html Note's html content
     * @returns {$toc: jQuery, headingCount: integer} ordered list table of headings, nested by heading level
     *         with an onclick event that will cause the document to scroll to
     *         the desired position.
     */
    getToc(html) {
        // Regular expression for headings <h1>...</h1> using non-greedy
        // matching and backreferences
        const headingTagsRegex = /<h(\d+)[^>]*>(.*?)<\/h\1>/gi;

        // Use jquery to build the table rather than html text, since it makes
        // it easier to set the onclick event that will be executed with the
        // right captured callback context
        const $toc = $("<ol>");
        // Note heading 2 is the first level Trilium makes available to the note
        let curLevel = 2;
        const $ols = [$toc];
        let headingCount;
        for (let m = null, headingIndex = 0; ((m = headingTagsRegex.exec(html)) !== null); headingIndex++) {
            //
            // Nest/unnest whatever necessary number of ordered lists
            //
            const newLevel = m[1];
            const levelDelta = newLevel - curLevel;
            if (levelDelta > 0) {
                // Open as many lists as newLevel - curLevel
                for (let i = 0; i < levelDelta; i++) {
                    const $ol = $("<ol>");
                    $ols[$ols.length - 1].append($ol);
                    $ols.push($ol);
                }
            } else if (levelDelta < 0) {
                // Close as many lists as curLevel - newLevel
                // be careful not to empty $ols completely, the root element should stay (could happen with a rogue h1 element)
                for (let i = 0; i < -levelDelta && $ols.length > 1; ++i) {
                    $ols.pop();
                }
            }
            curLevel = newLevel;

            //
            // Create the list item and set up the click callback
            //

            const headingText = $("<div>").html(m[2]).text();
            const $li = $('<li>').text(headingText);
            $li.on("click", () => this.jumpToHeading(headingIndex));
            $ols[$ols.length - 1].append($li);
            headingCount = headingIndex;
        }

        return {
            $toc,
            headingCount
        };
    }

    async jumpToHeading(headingIndex) {
        // A readonly note can change state to "readonly disabled
        // temporarily" (ie "edit this note" button) without any
        // intervening events, do the readonly calculation at navigation
        // time and not at outline creation time
        // See https://github.com/zadam/trilium/issues/2828
        const isReadOnly = await this.noteContext.isReadOnly();

        let $container;
        if (isReadOnly) {
            $container = await this.noteContext.getContentElement();
        } else {
            const textEditor = await this.noteContext.getTextEditor();
            $container = $(textEditor.sourceElement);
        }

        const headingElement = $container?.find(":header:not(section.include-note :header)")?.[headingIndex];
        headingElement?.scrollIntoView({ behavior: "smooth" });
    }

    async closeTocCommand() {
        this.noteContext.viewScope.tocTemporarilyHidden = true;
        await this.refresh();
        this.triggerCommand('reEvaluateRightPaneVisibility');
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteContentReloaded(this.noteId)) {
            await this.refresh();
        } else if (loadResults.getAttributeRows().find(attr => attr.type === 'label'
            && (attr.name.toLowerCase().includes('readonly') || attr.name === 'toc')
            && attributeService.isAffecting(attr, this.note))) {

            await this.refresh();
        }
    }
}


class CloseTocButton extends OnClickButtonWidget {
    constructor() {
        super();

        this.icon("bx-x")
            .title("Close TOC")
            .titlePlacement("left")
            .onClick((widget, e) => {
                e.stopPropagation();

                widget.triggerCommand("closeToc");
            })
            .class("icon-action close-toc");
    }
}
