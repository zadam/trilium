/**
 * Table of contents widget
 * (c) Antonio Tejada 2022
 *
 * By design there's no support for nonsensical or malformed constructs:
 * - headings inside elements (e.g. Trilium allows headings inside tables, but
 *   not inside lists)
 * - nested headings when using raw HTML <H2><H3></H3></H2>
 * - malformed headings when using raw HTML <H2></H3></H2><H3>
 * - etc.
 *
 * In those cases the generated TOC may be incorrect or the navigation may lead
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
        }
        
        .toc li:hover {
            font-weight: bold;
        }
        
        .close-toc {
            position: absolute;
            top: 2px;
            right: 2px;
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
        const tocLabel = note.getLabel('toc');

        if (tocLabel?.value === 'hide') {
            this.toggleInt(false);
            this.triggerCommand("reEvaluateRightPaneVisibility");
            return;
        }

        let $toc = "", headingCount = 0;
        // Check for type text unconditionally in case alwaysShowWidget is set
        if (this.note.type === 'text') {
            const { content } = await note.getNoteComplement();
            ({$toc, headingCount} = await this.getToc(content));
        }

        this.$toc.html($toc);
        this.toggleInt(
            ["", "show"].includes(tocLabel?.value)
            || headingCount >= options.getInt('minTocHeadings')
        );

        this.triggerCommand("reEvaluateRightPaneVisibility");
    }

    /**
     * Builds a jquery table of contents.
     *
     * @param {String} html Note's html content
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

        if (isReadOnly) {
            const $container = await this.noteContext.getContentElement();
            const headingElement = $container.find(":header")[headingIndex];

            if (headingElement != null) {
                headingElement.scrollIntoView({ behavior: "smooth" });
            }
        } else {
            const textEditor = await this.noteContext.getTextEditor();

            const model = textEditor.model;
            const doc = model.document;
            const root = doc.getRoot();

            const headingNode = findHeadingNodeByIndex(root, headingIndex);

            // headingNode could be null if the html was malformed or
            // with headings inside elements, just ignore and don't
            // navigate (note that the TOC rendering and other TOC
            // entries' navigation could be wrong too)
            if (headingNode != null) {
                $(textEditor.editing.view.domRoots.values().next().value).find(':header')[headingIndex].scrollIntoView({
                    behavior: 'smooth'
                });
            }
        }
    }

    async closeTocCommand() {
        this.noteContext.viewScope.tocTemporarilyHidden = true;
        await this.refresh();
        this.triggerCommand('reEvaluateRightPaneVisibility');
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteContentReloaded(this.noteId)) {
            await this.refresh();
        } else if (loadResults.getAttributes().find(attr => attr.type === 'label'
            && (attr.name.toLowerCase().includes('readonly') || attr.name === 'toc')
            && attributeService.isAffecting(attr, this.note))) {

            await this.refresh();
        }
    }
}

/**
 * Find a heading node in the parent's children given its index.
 *
 * @param {Element} parent Parent node to find a headingIndex'th in.
 * @param {uint} headingIndex Index for the heading
 * @returns {Element|null} Heading node with the given index, null couldn't be
 *          found (ie malformed like nested headings, etc.)
 */
function findHeadingNodeByIndex(parent, headingIndex) {
    let headingNode = null;
    for (let i = 0; i < parent.childCount; ++i) {
        let child = parent.getChild(i);

        // Headings appear as flattened top level children in the CKEditor
        // document named as "heading" plus the level, eg "heading2",
        // "heading3", "heading2", etc. and not nested wrt the heading level. If
        // a heading node is found, decrement the headingIndex until zero is
        // reached
        if (child.name.startsWith("heading")) {
            if (headingIndex === 0) {
                headingNode = child;
                break;
            }
            headingIndex--;
        }
    }

    return headingNode;
}

class CloseTocButton extends OnClickButtonWidget {
    constructor() {
        super();

        this.icon("bx-x")
            .title("Close TOC")
            .titlePlacement("bottom")
            .onClick((widget, e) => {
                e.stopPropagation();

                widget.triggerCommand("closeToc");
            })
            .class("icon-action close-toc");
    }
}
