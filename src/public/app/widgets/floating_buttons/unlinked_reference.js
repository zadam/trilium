/**
 * Work in progress
 * file based on backlinks widget
 * goal: 
 *   show   reference to this page title in other notes, similar to Roam research or logseq
 *   prototype working, showing note title. need to show execerpt.
 *   also, it show notes which already have an internal backling... 
 *   need to find a way to strip these from the search results.
 */

import NoteContextAwareWidget from "../note_context_aware_widget.js";
import linkService from "../../services/link.js";
import server from "../../services/server.js";
import froca from "../../services/froca.js";

const TPL = `
<div class="unlinkedrefs-widget">
    <style>
        .unlinkedrefs-widget {
            position: relative;
        }
    
        .unlinkedrefs-ticker {
            border-radius: 10px;
            border-color: var(--main-border-color);
            background-color: var(--more-accented-background-color);
            padding: 4px 10px 4px 10px;
            opacity: 90%;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .unlinkedrefs-count {
            cursor: pointer;
        }
                        
        .unlinkedrefs-items {
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
        
        .unlinkedrefs-excerpt {
            border-left: 2px solid var(--main-border-color);
            padding-left: 10px;
            opacity: 80%;
            font-size: 90%;
        }
        
        .unlinkedrefs-excerpt .unlinkedref-link { /* the actual unlinked reference */
            font-weight: bold;
            background-color: yellow;
        }
    </style>
    
    <div class="unlinkedrefs-ticker">
        <span class="unlinkedrefs-count"></span>
    </div>   
    
    <div class="unlinkedrefs-items" style="display: none;"></div>
</div>
`;

export default class UnlinkedRefsWidget extends NoteContextAwareWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$count = this.$widget.find('.unlinkedrefs-count');
        this.$items = this.$widget.find('.unlinkedrefs-items');
        this.$ticker = this.$widget.find('.unlinkedrefs-ticker');

        this.$count.on("click", () => {
            this.$items.toggle();
            this.$items.css("max-height", $(window).height() - this.$items.offset().top - 10);

            if (this.$items.is(":visible")) {
                this.renderUnlinkedRefs();
            }
        });

        this.contentSized();
    }

    async refreshWithNote(note) {
        this.clearItems();


        const resp = await server.get(`search/"${this.note.title}"`);  //array of noteId
        
        if (!resp || !(resp.length - 1) ) {
           this.$ticker.hide();
           return;
        }

        this.$ticker.show();
        this.$count.text(
            `${resp.length - 1 } unlinked ref`  //because current noteId is in array
            + (resp.length === 1 ? '' : 's')
        );
    }

    clearItems() {
        this.$items.empty().hide();
    }

    async renderUnlinkedRefs() {
        if (!this.note) {
            return;
        }

        this.$items.empty();

        const searchString = `note.content = "${this.note.title}"`

        //get an array of noteId with content or title matching current note title
        const unlinkedrefs = await server.get(`search/"${this.note.title}"`);  
        
        if (!unlinkedrefs.length) {
            return;
        }
        // remove noteId from current note, no need to display this one
        const index = unlinkedrefs.indexOf(this.noteId)
        if (index > -1) { 
            unlinkedrefs.splice(index, 1); 
          }

        await froca.getNotes(unlinkedrefs); // prefetch all
        
        for (let noteId of unlinkedrefs) {
            const $item = $("<div>");

            $item.append(await linkService.createNoteLink(noteId, {
                showNoteIcon: true,
                showNotePath: true,
                showTooltip: false
            }));

            //refactor to do here to show note excerpts

            // if (potentiallink.relationName) {
            //     $item.append($("<p>").text("relation: " + potentiallink.relationName));
            // }
            // else {
            //     $item.append(...potentiallink.excerpts);
            // }

            this.$items.append($item);
        }
    }
}
