import linkService from "./link.js";
import noteContentRenderer from "./note_content_renderer.js";
import treeCache from "./tree_cache.js";
import attributeService from "./attributes.js";

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
    }
    
    .note-list.grid-view .note-expander {
        display: none;
    }
    
    .note-list.grid-view .note-book-card {
        max-height: 300px;
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
    }
    
    .note-book-title {
        margin-bottom: 0;
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
    
    .note-book-content.type-image img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }
    
    .note-book-card.type-image .note-book-content img, .note-book-card.type-text .note-book-content img {
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
        padding-right: 3px;
        cursor: pointer;
    }
    
    .note-list-pager {
        text-align: center;
    }
    </style>
    
    <div class="btn-group floating-button" style="right: 20px; top: 10px;">
        <button type="button"
                class="collapse-all-button btn icon-button bx bx-layer-minus"
                title="Collapse all notes"></button>

        &nbsp;
        
        <button type="button"
                class="expand-children-button btn icon-button bx bx-move-vertical"
                title="Expand all children"></button>

        &nbsp;

        <button type="button"
                class="list-view-button btn icon-button bx bx-menu"
                title="List view"></button>

        &nbsp;

        <button type="button"
                class="grid-view-button btn icon-button bx bx-grid-alt"
                title="Grid view"></button>
    </div>

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
    constructor(parentNote, noteIds) {
        this.$noteList = $(TPL);
        this.parentNote = parentNote;
        this.noteIds = noteIds;
        this.page = 1;
        this.pageSize = parseInt(parentNote.getLabelValue('pageSize'));

        if (!this.pageSize || this.pageSize < 1 || this.pageSize > 10000) {
            this.pageSize = 10;
        }

        this.viewType = parentNote.getLabelValue('viewType');

        if (!['list', 'grid'].includes(this.viewType)) {
            this.viewType = 'list'; // default
        }

        this.$noteList.addClass(this.viewType + '-view');

        this.$noteList.find('.list-view-button').on('click', () => this.toggleViewType('list'));
        this.$noteList.find('.grid-view-button').on('click', () => this.toggleViewType('grid'));

        this.$noteList.find('.expand-children-button').on('click', async () => {
            if (!this.parentNote.hasLabel('expanded')) {
                await attributeService.addLabel(this.parentNote.noteId, 'expanded');
            }

            await this.renderList();
        });

        this.$noteList.find('.collapse-all-button').on('click', async () => {
            // owned is important - we shouldn't remove inherited expanded labels
            for (const expandedAttr of this.parentNote.getOwnedLabels('expanded')) {
                await attributeService.removeAttributeById(this.parentNote.noteId, expandedAttr.attributeId);
            }

            await this.renderList();
        });
    }

    async toggleViewType(type) {
        if (type !== 'list' && type !== 'grid') {
            throw new Error(`Invalid view type ${type}`);
        }

        this.viewType = type;

        this.$noteList
            .removeClass('grid-view')
            .removeClass('list-view')
            .addClass(this.viewType + '-view');

        await attributeService.setLabel(this.parentNote.noteId, 'viewType', type);

        await this.renderList();
    }

    async renderList() {
        const $container = this.$noteList.find('.note-list-container').empty();

        const imageLinks = this.parentNote ? this.parentNote.getRelations('imageLink') : [];

        const startIdx = (this.page - 1) * this.pageSize;
        const endIdx = startIdx + this.pageSize;

        const pageNoteIds = this.noteIds.slice(startIdx, Math.min(endIdx, this.noteIds.length));
        const pageNotes = await treeCache.getNotes(pageNoteIds);

        for (const note of pageNotes) {
            // image is already visible in the parent note so no need to display it separately in the book
            if (imageLinks.find(rel => rel.value === note.noteId)) {
                continue;
            }

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

        for (let i = 1; i <= pageCount; i++) {
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
    }

    // TODO: we should also render (promoted) attributes
    // FIXME: showing specific path might be necessary because of a match in the patch
    async renderNote(note, expand = false) {
        const notePath = /*this.notePath + '/' + */ note.noteId;

        const $expander = $('<span class="note-expander bx bx-chevron-right"></span>');

        const $card = $('<div class="note-book-card">')
            .attr('data-note-id', note.noteId)
            .append(
                $('<h5 class="note-book-title">')
                    .append($expander)
                    .append(await linkService.createNoteLink(notePath, {showTooltip: false}))
            );

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
            const {renderedContent, type} = await noteContentRenderer.getRenderedContent(note, {
                trim: this.viewType === 'grid' // for grid only short content is needed
            });

            $content.append(renderedContent);
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
