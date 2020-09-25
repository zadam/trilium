import linkService from "../services/link.js";
import server from "../services/server.js";
import treeCache from "../services/tree_cache.js";
import TabAwareWidget from "./tab_aware_widget.js";
import options from "../services/options.js";

const TPL = `
<div class="similar-notes-widget hide-in-zen-mode">
    <style>    
    .similar-notes-wrapper {
        max-height: 75px;
        overflow: auto;
    }

    .similar-notes-wrapper a {
        display: inline-block;
        border: 1px dotted var(--main-border-color);
        border-radius: 20px;
        background-color: var(--accented-background-color);
        padding: 0 10px 0 10px;
        margin: 0 3px 0 3px;
        max-width: 10em;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
    }
    </style>

    <div class="area-expander">
        <hr class="w-100">
        
        <div class="area-expander-text"
             title="This list contains notes which might be similar to the current note based on textual similarity of note title, its labels and relations."></div>
        
        <hr class="w-100">
    </div>

    <div class="similar-notes-wrapper"></div>
</div>
`;

export default class SimilarNotesWidget extends TabAwareWidget {
    isEnabled() {
        return super.isEnabled() && !this.note.hasLabel('similarNotesWidgetDisabled');
    }

    doRender() {
        this.$widget = $(TPL);
        this.overflowing();

        this.$similarNotesWrapper = this.$widget.find(".similar-notes-wrapper");
        this.$expanderText = this.$widget.find(".area-expander-text");

        this.$expander = this.$widget.find('.area-expander');
        this.$expander.on('click', async () => {
            const collapse = this.$similarNotesWrapper.is(":visible");

            await options.save('similarNotesExpanded', !collapse);

            this.triggerEvent(`similarNotesCollapsedStateChanged`, {collapse});
        });

        return this.$widget;
    }

    noteSwitched() {
        const noteId = this.noteId;

        this.toggleInt(false);
        this.$similarNotesWrapper.hide(); // we'll open it in refresh() if needed

        // avoid executing this expensive operation multiple times when just going through notes (with keyboard especially)
        // until the users settles on a note
        setTimeout(() => {
            if (this.noteId === noteId) {
                this.refresh();
            }
        }, 1000);
    }

    async refresh() {
        if (!this.isEnabled()) {
            return;
        }

        // remember which title was when we found the similar notes
        this.title = this.note.title;

        const similarNotes = await server.get('similar-notes/' + this.noteId);

        this.toggleInt(similarNotes.length > 0);

        if (similarNotes.length === 0) {
            return;
        }

        if (options.is('similarNotesExpanded')) {
            this.$similarNotesWrapper.show();
        }

        this.$expanderText.text(`${similarNotes.length} similar note${similarNotes.length === 1 ? '': "s"}`);

        const noteIds = similarNotes.flatMap(note => note.notePath);

        await treeCache.getNotes(noteIds, true); // preload all at once

        const $list = $('<div>');

        for (const similarNote of similarNotes) {
            const note = await treeCache.getNote(similarNote.noteId, true);

            if (!note) {
                continue;
            }

            const $item = (await linkService.createNoteLink(similarNote.notePath.join("/")))
                .css("font-size", 24 * (1 - 1 / (1 +  similarNote.score)));

            $list.append($item);
        }

        this.$similarNotesWrapper.empty().append($list);
    }

    entitiesReloadedEvent({loadResults}) {
        if (this.note && this.title !== this.note.title) {
            this.rendered = false;

            this.refresh();
        }
    }

    /**
     * This event is used to synchronize collapsed state of all the tab-cached widgets since they are all rendered
     * separately but should behave uniformly for the user.
     */
    similarNotesCollapsedStateChangedEvent({collapse}) {
        if (collapse) {
            this.$similarNotesWrapper.slideUp(200);
        } else {
            this.$similarNotesWrapper.slideDown(200);
        }
    }
}
