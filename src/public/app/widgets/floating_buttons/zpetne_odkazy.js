/**
 * !!! Filename is intentionally mangled, because some adblockers don't like the word "backlinks".
 */

import NoteContextAwareWidget from "../note_context_aware_widget.js";
import linkService from "../../services/link.js";
import server from "../../services/server.js";
import froca from "../../services/froca.js";

const TPL = `
<div class="backlinks-widget">
    <style>
        .backlinks-widget {
            position: relative;
        }
    
        .backlinks-ticker {
            border-radius: 10px;
            border-color: var(--main-border-color);
            background-color: var(--more-accented-background-color);
            padding: 4px 10px 4px 10px;
            opacity: 90%;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .backlinks-count {
            cursor: pointer;
        }
                        
        .backlinks-items {
            z-index: 10;
            position: absolute;
            top: 50px;
            right: 10px;
            width: 400px;
            border-radius: 10px;
            background-color: var(--accented-background-color);
            color: var(--main-text-color);
            padding: 20px;
            overflow-y: auto;
        }
        
        .backlink-excerpt {
            border-left: 2px solid var(--main-border-color);
            padding-left: 10px;
            opacity: 80%;
            font-size: 90%;
        }
        
        .backlink-excerpt .backlink-link { /* the actual backlink */
            font-weight: bold;
            background-color: yellow;
        }
    </style>
    
    <div class="backlinks-ticker">
        <span class="backlinks-count"></span>
    </div>   
    
    <div class="backlinks-items" style="display: none;"></div>
</div>
`;

export default class BacklinksWidget extends NoteContextAwareWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$count = this.$widget.find('.backlinks-count');
        this.$items = this.$widget.find('.backlinks-items');
        this.$ticker = this.$widget.find('.backlinks-ticker');

        this.$count.on("click", () => {
            this.$items.toggle();
            this.$items.css("max-height", $(window).height() - this.$items.offset().top - 10);

            if (this.$items.is(":visible")) {
                this.renderBacklinks();
            }
        });

        this.contentSized();
    }

    async refreshWithNote(note) {
        this.clearItems();

        // can't use froca since that would count only relations from loaded notes
        const resp = await server.get(`notes/${this.noteId}/backlink-count`);

        if (!resp || !resp.count) {
            this.$ticker.hide();
            return;
        }

        this.$ticker.show();
        this.$count.text(
            `${resp.count} backlink`
            + (resp.count === 1 ? '' : 's')
        );
    }

    clearItems() {
        this.$items.empty().hide();
    }

    async renderBacklinks() {
        if (!this.note) {
            return;
        }

        this.$items.empty();

        const backlinks = await server.get(`note-map/${this.noteId}/backlinks`);

        if (!backlinks.length) {
            return;
        }

        await froca.getNotes(backlinks.map(bl => bl.noteId)); // prefetch all

        for (const backlink of backlinks) {
            const $item = $("<div>");

            $item.append(await linkService.createNoteLink(backlink.noteId, {
                showNoteIcon: true,
                showNotePath: true,
                showTooltip: false
            }));

            if (backlink.relationName) {
                $item.append($("<p>").text("relation: " + backlink.relationName));
            }
            else {
                $item.append(...backlink.excerpts);
            }

            this.$items.append($item);
        }
    }
}
