import linkService from "./link.js";
import noteContentRenderer from "./note_content_renderer.js";
import treeCache from "./tree_cache.js";

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
        padding: 15px;
        padding-bottom: 5px;
        margin: 5px;
        margin-left: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
    }
    
    .note-book-card .note-book-card {
        border: 1px solid var(--main-border-color);
    }
    
    .note-book-card.type-image .note-book-content, .note-book-card.type-file .note-book-content, .note-book-card.type-protected-session .note-book-content {
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
        top: 2px;
        cursor: pointer;
    }
    </style>
    
    <div class="btn-group floating-button" style="right: 20px; top: 10px;">
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

async function renderList(notes, parentNote = null) {
    const $noteList = $(TPL);

    // $zoomInButton.on('click', () => this.setZoom(this.zoomLevel - 1));
    // $zoomOutButton.on('click', () => this.setZoom(this.zoomLevel + 1));
    //
    // $expandChildrenButton.on('click', async () => {
    //     for (let i = 1; i < 30; i++) { // protection against infinite cycle
    //         const $unexpandedLinks = this.$content.find('.note-book-open-children-button:visible');
    //
    //         if ($unexpandedLinks.length === 0) {
    //             break;
    //         }
    //
    //         for (const link of $unexpandedLinks) {
    //             const $card = $(link).closest(".note-book-card");
    //
    //             await this.expandCard($card);
    //         }
    //     }
    // });

    $noteList.on('click', '.note-book-open-children-button', async ev => {
        const $card = $(ev.target).closest('.note-book-card');

        await expandCard($card);
    });

    $noteList.on('click', '.note-book-hide-children-button', async ev => {
        const $card = $(ev.target).closest('.note-book-card');

        $card.find('.note-book-open-children-button').show();
        $card.find('.note-book-hide-children-button').hide();

        $card.find('.note-book-children-content').empty();
    });

    const $container = $noteList.find('.note-list-container');

    const imageLinks = parentNote ? parentNote.getRelations('imageLink') : [];

    for (const note of notes) {
        // image is already visible in the parent note so no need to display it separately in the book
        if (imageLinks.find(rel => rel.value === note.noteId)) {
            continue;
        }

        const $card = await renderNote(note);

        $container.append($card);
    }

    return $noteList;
}

// TODO: we should also render (promoted) attributes
async function renderNote(note, renderContent) {
    const notePath = /*this.notePath + '/' + */ note.noteId;

    const $content = $('<div class="note-book-content">')
        .css("max-height", ZOOMS[zoomLevel].height);

    const $card = $('<div class="note-book-card">')
        .attr('data-note-id', note.noteId)
        .css("flex-basis", ZOOMS[zoomLevel].width)
        .append(
            $('<h5 class="note-book-title">')
                .append('<span class="note-expander bx bx-chevron-right"></span>')
                .append(await linkService.createNoteLink(notePath, {showTooltip: false}))
        )
        .append($content);

    if (renderContent) {
        try {
            const {type, renderedContent} = await noteContentRenderer.getRenderedContent(note);

            $card.addClass("type-" + type);
            $content.append(renderedContent);
        } catch (e) {
            console.log(`Caught error while rendering note ${note.noteId} of type ${note.type}: ${e.message}, stack: ${e.stack}`);

            $content.append("rendering error");
        }

        const imageLinks = note.getRelations('imageLink');

        const childCount = note.getChildNoteIds()
            .filter(childNoteId => !imageLinks.find(rel => rel.value === childNoteId))
            .length;

        if (childCount > 0) {
            const label = `${childCount} child${childCount > 1 ? 'ren' : ''}`;

            $card.append($('<div class="note-book-children">')
                .append($(`<a class="note-book-open-children-button no-print" href="javascript:">+ Show ${label}</a>`))
                .append($(`<a class="note-book-hide-children-button no-print" href="javascript:">- Hide ${label}</a>`).hide())
                .append($('<div class="note-book-children-content">'))
            );
        }
    }

    return $card;
}

async function expandCard($card) {
    const noteId = $card.attr('data-note-id');
    const note = await treeCache.getNote(noteId);

    $card.find('.note-book-open-children-button').hide();
    $card.find('.note-book-hide-children-button').show();

    $card.find('.note-book-children-content').append(await renderList(await note.getChildNotes(), note));
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
