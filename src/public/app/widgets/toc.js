/**
 * Table of contents widget
 * (c) Antonio Tejada 2022
 *
 * By design there's no support for non-sensical or malformed constructs:
 * - headings inside elements (eg Trilium allows headings inside tables, but
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
import CollapsibleWidget from "./collapsible_widget.js";
import options from "../services/options.js";

const TPL = `<div class="toc-widget">
    <style>
        .toc-widget {
            padding: 10px;
            contain: none; 
            overflow:auto;
        }
        
        .toc ol {
            padding-left: 25px;
        }
        
        .toc > ol {
            padding-left: 10px;
        }
    </style>

    <span class="toc"></span>
</div>`;

/**
 * Find a heading node in the parent's children given its index.
 *
 * @param {Element} parent Parent node to find a headingIndex'th in.
 * @param {uint} headingIndex Index for the heading
 * @returns {Element|null} Heading node with the given index, null couldn't be
 *          found (ie malformed like nested headings, etc)
 */
function findHeadingNodeByIndex(parent, headingIndex) {
    let headingNode = null;
    for (let i = 0; i < parent.childCount; ++i) {
        let child = parent.getChild(i);

        // Headings appear as flattened top level children in the CKEditor
        // document named as "heading" plus the level, eg "heading2",
        // "heading3", "heading2", etc and not nested wrt the heading level. If
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

export default class TocWidget extends CollapsibleWidget {
    get widgetTitle() {
        return "Table of Contents";
    }

    isEnabled() {
        return super.isEnabled() && this.note.type === 'text';
    }

    async doRenderBody() {
        this.$body.empty().append($(TPL));
        this.$toc = this.$body.find('.toc');
    }

    async refreshWithNote(note) {
        const tocLabel = note.getLabel('toc');

        if (tocLabel?.value === 'hide') {
            this.toggleInt(false);
            this.triggerCommand("reevaluateIsEnabled");
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

        this.triggerCommand("reevaluateIsEnabled");
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
        const headingTagsRegex = /<h(\d+)>(.*?)<\/h\1>/g;

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
                for (let i = 0; i < -levelDelta; ++i) {
                    $ols.pop();
                }
            }
            curLevel = newLevel;

            //
            // Create the list item and set up the click callback
            //

            const headingText = $("<div>").html(m[2]).text();
            const $li = $('<li style="cursor:pointer">').text(headingText);
            // XXX Do this with CSS? How to inject CSS in doRender?
            $li.hover(function () {
                $(this).css("font-weight", "bold");
            }).mouseout(function () {
                $(this).css("font-weight", "normal");
            });
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
                headingElement.scrollIntoView();
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
                // Setting the selection alone doesn't scroll to the
                // caret, needs to be done explicitly and outside of
                // the writer change callback so the scroll is
                // guaranteed to happen after the selection is
                // updated.

                // In addition, scrolling to a caret later in the
                // document (ie "forward scrolls"), only scrolls
                // barely enough to place the caret at the bottom of
                // the screen, which is a usability issue, you would
                // like the caret to be placed at the top or center
                // of the screen.

                // To work around that issue, first scroll to the
                // end of the document, then scroll to the desired
                // point. This causes all the scrolls to be
                // "backward scrolls" no matter the current caret
                // position, which places the caret at the top of
                // the screen.

                // XXX This could be fixed in another way by using
                //     the underlying CKEditor5
                //     scrollViewportToShowTarget, which allows to
                //     provide a larger "viewportOffset", but that
                //     has coding complications (requires calling an
                //     internal CKEditor utils funcion and passing
                //     an HTML element, not a CKEditor node, and
                //     CKEditor5 doesn't seem to have a
                //     straightforward way to convert a node to an
                //     HTML element? (in CKEditor4 this was done
                //     with $(node.$) )

                // Scroll to the end of the note to guarantee the
                // next scroll is a backwards scroll that places the
                // caret at the top of the screen
                model.change(writer => {
                    writer.setSelection(root.getChild(root.childCount - 1), 0);
                });
                textEditor.editing.view.scrollToTheSelection();
                // Backwards scroll to the heading
                model.change(writer => {
                    writer.setSelection(headingNode, 0);
                });
                textEditor.editing.view.scrollToTheSelection();
            }
        }
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
