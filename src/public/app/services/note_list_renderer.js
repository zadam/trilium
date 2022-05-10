import linkService from "./link.js";
import noteContentRenderer from "./note_content_renderer.js";
import froca from "./froca.js";
import attributeRenderer from "./attribute_renderer.js";

const TPL = `
<div class="note-list">
    <style>
    .note-list {
        overflow: hidden;
        position: relative;
        height: 100%;
    }
    
    .note-list.grid-view .note-list-container {
        display: flex;
        flex-wrap: wrap;
    }
    
    .note-list.grid-view .note-book-card {
        flex-basis: 300px;
        border: 1px solid transparent;
    }
    
    .note-list.grid-view .note-expander {
        display: none;
    }
    
    .note-list.grid-view .note-book-card {
        max-height: 300px;
    }
    
    .note-list.grid-view .note-book-card:hover {
        cursor: pointer;
        border: 1px solid var(--main-border-color);
        background: var(--more-accented-background-color);
    }
    
    .note-book-card {
        border-radius: 10px;
        background-color: var(--accented-background-color);
        padding: 10px 15px 15px 8px;
        margin: 5px 5px 5px 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        flex-grow: 1;
    }
    
    .note-book-card:not(.expanded) .note-book-content {
        display: none !important;
        padding: 10px
    }
    
    .note-book-card.expanded .note-book-content {
        display: block;
        min-height: 0;
        height: 100%;
        padding-top: 10px;
    }
    
    .note-book-title {
        margin-bottom: 0;
        word-break: break-all;
    }
    
    /* not-expanded title is limited to one line only */
    .note-book-card:not(.expanded) .note-book-title {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    
    .note-book-title .rendered-note-attributes {
        font-size: medium;
    }
    
    .note-book-title .rendered-note-attributes:before {
        content: "\\00a0\\00a0";
    }
    
    .note-book-title .note-icon {
        font-size: 100%;
        display: inline-block;
        padding-right: 7px;
        position: relative;
    }
    
    .note-book-card .note-book-card {
        border: 1px solid var(--main-border-color);
    }
    
    .note-book-content.type-image, .note-book-content.type-file, .note-book-content.type-protected-session {
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 10px;
    }
    
    .note-book-content.type-image img, .note-book-content.type-canvas svg {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }
    
    .note-book-card.type-image .note-book-content img,
    .note-book-card.type-text .note-book-content img,
    .note-book-card.type-canvas .note-book-content img {
        max-width: 100%;
        max-height: 100%;
    }
    
    .note-book-title {
        flex-grow: 0;
    }
    
    .note-list-wrapper {
        height: 100%;
        overflow: auto;
    }
    
    .note-expander {
        font-size: x-large;
        position: relative;
        top: 3px;
        cursor: pointer;
    }
    
    .note-list-pager {
        text-align: center;
    }
    </style>
    
    <div class="note-list-wrapper">
        <div class="note-list-pager"></div>
    
        <div class="note-list-container"></div>
        
        <div class="note-list-pager"></div>
    </div>
</div>`;

class NoteListRenderer {
    /*
     * We're using noteIds so that it's not necessary to load all notes at once when paging
     */
    constructor($parent, parentNote, noteIds, showNotePath = false) {
        this.$noteList = $(TPL);

        // note list must be added to the DOM immediatelly, otherwise some functionality scripting (canvas) won't work
        $parent.empty();

        this.parentNote = parentNote;
        const includedNoteIds = this.getIncludedNoteIds();

        this.noteIds = noteIds.filter(noteId => !includedNoteIds.has(noteId) && noteId !== 'hidden');

        if (this.noteIds.length === 0) {
            return;
        }

        $parent.append(this.$noteList);

        this.page = 1;
        this.pageSize = parseInt(parentNote.getLabelValue('pageSize'));

        if (!this.pageSize || this.pageSize < 1) {
            this.pageSize = 20;
        }

        this.viewType = parentNote.getLabelValue('viewType');

        if (!['list', 'grid'].includes(this.viewType)) {
            // when not explicitly set decide based on note type
            this.viewType = parentNote.type === 'search' ? 'list' : 'grid';
        }

        this.$noteList.addClass(this.viewType + '-view');

        this.showNotePath = showNotePath;
    }

    /** @returns {Set<string>} list of noteIds included (images, included notes) into a parent note and which
     *                        don't have to be shown in the note list. */
    getIncludedNoteIds() {
        const includedLinks = this.parentNote
            ? this.parentNote.getRelations().filter(rel => rel.name === 'imageLink' || rel.name === 'includeNoteLink')
            : [];

        return new Set(includedLinks.map(rel => rel.value));
    }

    async renderList() {
        if (this.noteIds.length === 0) {
            this.$noteList.hide();
            return;
        }

        this.$noteList.show();

        const $container = this.$noteList.find('.note-list-container').empty();

        const startIdx = (this.page - 1) * this.pageSize;
        const endIdx = startIdx + this.pageSize;

        const pageNoteIds = this.noteIds.slice(startIdx, Math.min(endIdx, this.noteIds.length));
        const pageNotes = await froca.getNotes(pageNoteIds);

        for (const note of pageNotes) {
            const $card = await this.renderNote(note, this.parentNote.hasLabel('expanded'));

            $container.append($card);
        }

        this.renderPager();

        return this.$noteList;
    }

    renderPager() {
        const $pager = this.$noteList.find('.note-list-pager').empty();
        const pageCount = Math.ceil(this.noteIds.length / this.pageSize);

        $pager.toggle(pageCount > 1);

        let lastPrinted;

        for (let i = 1; i <= pageCount; i++) {
            if (pageCount < 20 || i <= 5 || pageCount - i <= 5 || Math.abs(this.page - i) <= 2) {
                lastPrinted = true;

                $pager.append(
                    i === this.page
                        ? $('<span>').text(i).css('text-decoration', 'underline').css('font-weight', "bold")
                        : $('<a href="javascript:">')
                            .text(i)
                            .on('click', () => {
                                this.page = i;
                                this.renderList();
                            }),
                    " &nbsp; "
                );
            }
            else if (lastPrinted) {
                $pager.append("... &nbsp; ");

                lastPrinted = false;
            }
        }
    }

    async renderNote(note, expand = false) {
        const $expander = $('<span class="note-expander bx bx-chevron-right"></span>');

        const {$renderedAttributes} = await attributeRenderer.renderNormalAttributes(note);
        const notePath = this.parentNote.type === 'search'
            ? note.noteId // for search note parent we want to display non-search path
            : this.parentNote.noteId + '/' + note.noteId;

        const $card = $('<div class="note-book-card">')
            .attr('data-note-id', note.noteId)
            .append(
                $('<h5 class="note-book-title">')
                    .append($expander)
                    .append($('<span class="note-icon">').addClass(note.getIcon()))
                    .append(this.viewType === 'grid'
                        ? note.title
                        : await linkService.createNoteLink(notePath, {showTooltip: false, showNotePath: this.showNotePath})
                    )
                    .append($renderedAttributes)
            );

        if (this.viewType === 'grid') {
            $card
                .addClass("block-link")
                .attr("data-note-path", notePath)
                .on('click', e => linkService.goToLink(e));
        }

        $expander.on('click', () => this.toggleContent($card, note, !$card.hasClass("expanded")));

        await this.toggleContent($card, note, expand);

        return $card;
    }

    async toggleContent($card, note, expand) {
        if (this.viewType === 'list' && ((expand && $card.hasClass("expanded")) || (!expand && !$card.hasClass("expanded")))) {
            return;
        }

        const $expander = $card.find('> .note-book-title .note-expander');

        if (expand || this.viewType === 'grid') {
            $card.addClass("expanded");
            $expander.addClass("bx-chevron-down").removeClass("bx-chevron-right");
        }
        else {
            $card.removeClass("expanded");
            $expander.addClass("bx-chevron-right").removeClass("bx-chevron-down");
        }

        if ((expand || this.viewType === 'grid') && $card.find('.note-book-content').length === 0) {
            $card.append(await this.renderNoteContent(note));
        }
    }

    async renderNoteContent(note) {
        const $content = $('<div class="note-book-content">');

        try {
            const {$renderedContent, type} = await noteContentRenderer.getRenderedContent(note, {
                trim: this.viewType === 'grid' // for grid only short content is needed
            });

            $content.append($renderedContent);
            $content.addClass("type-" + type);
        } catch (e) {
            console.log(`Caught error while rendering note ${note.noteId} of type ${note.type}: ${e.message}, stack: ${e.stack}`);

            $content.append("rendering error");
        }

        if (this.viewType === 'list') {
            const imageLinks = note.getRelations('imageLink');

            const childNotes = (await note.getChildNotes())
                .filter(childNote => !imageLinks.find(rel => rel.value === childNote.noteId));

            for (const childNote of childNotes) {
                $content.append(await this.renderNote(childNote));
            }
        }

        return $content;
    }
}

export default NoteListRenderer;
