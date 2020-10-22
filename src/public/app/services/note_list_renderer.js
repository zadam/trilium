import linkService from "./link.js";
import noteContentRenderer from "./note_content_renderer.js";
import treeCache from "./tree_cache.js";
import attributeService from "./attributes.js";

const ZOOMS = {
    1: {
        width: "100%",
        height: "100%"
    },
    2: {
        width: "49%",
        height: "350px"
    },
    3: {
        width: "32%",
        height: "250px"
    },
    4: {
        width: "24%",
        height: "200px"
    },
    5: {
        width: "19%",
        height: "175px"
    },
    6: {
        width: "16%",
        height: "150px"
    }
};

const zoomLevel = 2;

const TPL = `
<div class="note-list">
    <style>
    .note-list {
        overflow: hidden;
        position: relative;
        height: 100%;
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
    }
    
    .note-book-card .note-book-content {
        display: none;
        padding: 10px
    }
    
    .note-book-card.expanded .note-book-content {
        display: block;
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
    }
    
    .note-book-card.type-image .note-book-content img, .note-book-card.type-text .note-book-content img {
        max-width: 100%;
        max-height: 100%;
    }
    
    .note-book-title {
        flex-grow: 0;
    }
    
    .note-list-container {
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

    <div class="note-list-container"></div>
</div>`;

async function toggleCards(cards, expand) {
    for (const card of cards) {
        const $card = $(card);
        const noteId = $card.attr('data-note-id');
        const note = await treeCache.getNote(noteId);

        await toggleContent($card, note, expand);
    }
}

async function renderPage(parentNote, notes, $container, page, pageSize) {
    const imageLinks = parentNote ? parentNote.getRelations('imageLink') : [];

    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;

    const pageNotes = notes.slice(startIdx, Math.min(endIdx, notes.length));

    for (const note of pageNotes) {
        // image is already visible in the parent note so no need to display it separately in the book
        if (imageLinks.find(rel => rel.value === note.noteId)) {
            continue;
        }

        const $card = await renderNote(note);

        $container.append($card);
    }
}

async function renderNoteListContent($noteList, parentNote, notes, page = 1, pageSize = 2) {
    const $container = $noteList.find('.note-list-container').empty();

    $container.append('<div class="note-list-pager"></div>');

    await renderPage(parentNote, notes, $container, page, pageSize);

    $container.append('<div class="note-list-pager"></div>');

    const $pager = $noteList.find('.note-list-pager');

    for (let i = 1; i <= Math.ceil(notes.length / pageSize); i++) {
        $pager.append(
            i === page
                ? $('<span>').text(i).css('text-decoration', 'underline').css('font-weight', "bold")
                : $('<a href="javascript:">')
                    .text(i)
                    .on('click', () => renderNoteListContent($noteList, parentNote, notes, i, pageSize)),
            " &nbsp; "
        );
    }
}

async function renderList(notes, parentNote) {
    const $noteList = $(TPL);

    $noteList.find('.expand-children-button').on('click', async () => {
        for (let i = 1; i < 30; i++) { // protection against infinite cycle
            const $unexpandedCards = $noteList.find('.note-book-card:not(.expanded)');

            if ($unexpandedCards.length === 0) {
                break;
            }

            await toggleCards($unexpandedCards, true);

            if (!parentNote.hasLabel('expanded')) {
                await attributeService.addLabel(parentNote.noteId, 'expanded');
            }
        }
    });

    $noteList.find('.collapse-all-button').on('click', async () => {
        const $expandedCards = $noteList.find('.note-book-card.expanded');

        await toggleCards($expandedCards, false);

        // owned is important - we shouldn't remove inherited expanded labels
        for (const expandedAttr of parentNote.getOwnedLabels('expanded')) {
            await attributeService.removeAttributeById(parentNote.noteId, expandedAttr.attributeId);
        }
    });

    await renderNoteListContent($noteList, parentNote, notes);

    return $noteList;
}

async function renderNoteContent(note) {
    const $content = $('<div class="note-book-content">');

    try {
        const {renderedContent, type} = await noteContentRenderer.getRenderedContent(note);

        $content.append(renderedContent);
        $content.addClass("type-" + type);
    } catch (e) {
        console.log(`Caught error while rendering note ${note.noteId} of type ${note.type}: ${e.message}, stack: ${e.stack}`);

        $content.append("rendering error");
    }

    const imageLinks = note.getRelations('imageLink');

    const childNotes = (await note.getChildNotes())
        .filter(childNote => !imageLinks.find(rel => rel.value === childNote.noteId));

    for (const childNote of childNotes) {
        $content.append(await renderNote(childNote, false));
    }

    return $content;
}

// TODO: we should also render (promoted) attributes
async function renderNote(note, expand) {
    const notePath = /*this.notePath + '/' + */ note.noteId;

    const $expander = $('<span class="note-expander bx bx-chevron-right"></span>');

    const $card = $('<div class="note-book-card">')
        .attr('data-note-id', note.noteId)
        .css("flex-basis", ZOOMS[zoomLevel].width)
        .append(
            $('<h5 class="note-book-title">')
                .append($expander)
                .append(await linkService.createNoteLink(notePath, {showTooltip: false}))
        );

    $expander.on('click', () => toggleContent($card, note, !$card.hasClass("expanded")));

    await toggleContent($card, note, expand);

    return $card;
}

async function toggleContent($card, note, expand) {
    if ((expand && $card.hasClass("expanded")) || (!expand && !$card.hasClass("expanded"))) {
        return;
    }

    const $expander = $card.find('> .note-book-title .note-expander');

    if (expand) {
        $card.addClass("expanded");
        $expander.addClass("bx-chevron-down").removeClass("bx-chevron-right");
    }
    else {
        $card.removeClass("expanded");
        $expander.addClass("bx-chevron-right").removeClass("bx-chevron-down");
    }

    if (expand && $card.find('.note-book-content').length === 0) {
        $card.append(await renderNoteContent(note));
    }
}

function setZoom(zoomLevel) {
    if (!(zoomLevel in ZOOMS)) {
        zoomLevel = this.getDefaultZoomLevel();
    }

    this.zoomLevel = zoomLevel;

    this.$zoomInButton.prop("disabled", zoomLevel === MIN_ZOOM_LEVEL);
    this.$zoomOutButton.prop("disabled", zoomLevel === MAX_ZOOM_LEVEL);

    this.$content.find('.note-book-card').css("flex-basis", ZOOMS[zoomLevel].width);
    this.$content.find('.note-book-content').css("max-height", ZOOMS[zoomLevel].height);
}

export default {
    renderList
};
