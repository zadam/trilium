import linkService from "./link.js";
import froca from "./froca.js";
import attributeRenderer from "./attribute_renderer.js";
import libraryLoader from "./library_loader.js";
import taskService from "./task.js";

const getSwimlaneTPL = (styleSuffix, title, parentTitle, deadline) => {return `
        <div class="task-swimlane-list-item-${styleSuffix}">
            <style>
                .task-swimlane-list-item-${styleSuffix} {
                    position:relative;
                    margin: 1px 0;
                    padding: 0 4px;
                    border: 1px solid #000;
                    background-color: var(--accented-background-color);
                }
                .task-swimlane-list-item-title {
                    word-break: break-space;
                    margin: 10px 0px;
                    max-width: 90%;
                    padding:0px;
                    left:0px;
                    text-overflow: ellipsis;
                }
    
                .task-swimlane-list-item-${styleSuffix}:hover {
                    cursor: pointer;
                    border: 1px solid var(--main-border-color);
                    background: var(--more-accented-background-color);
                }
    
                .task-swimlane-list-item-parent {
                    position:absolute; 
                    top:0; 
                    left:0; 
                    font-size:60%;
                    width: 200px;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    color: yellow;
                    overflow:hidden;
                }
    
                .task-swimlane-list-item-tag {
                    display:inline-block;
    
                    border-radius: 5px;
                    padding: 0px 4px;
                    margin: 0px 2px;
                    background-color: #00ff00;
                    color: black;
                    
                    font-family:'verdana';
                    font-size: 10px;
                    font-weight:bold;
                }
    
                .task-swimlane-list-item-tags {
                    display: inline;
                    position: absolute;
                    right:0;
                    bottom:0;
                    margin: 1px 0;
                }
    
                .task-swimlane-list-item-deadline {
                    position:absolute;
                    right:0;
                    top:0;
                    font-size:60%;
                    color:white;
                }
    
                .task-swimlane-list-item-deadline[severity=HOLYCOW] {
                    position:absolute;
                    right:0;
                    top:0;
                    font-size:100%;
                    font-weight:bold;
                    color:red;
                    animation: task-swimlane-list-item-deadline-blinker 1s step-end infinite;
                }
    
                .task-swimlane-list-item-deadline[severity=REDZONE] {
                    position:absolute;
                    right:0;
                    top:0;
                    font-size:80%;
                    font-weight:bold;
                    color:red;
                }
    
                .task-swimlane-list-item-group {
                    border: 3px dashed white;
                    margin-top: 1px;
                    margin-bottom:1px;                
                }
    
                .task-swimlane-list-item-deadline[severity=CAUTION] {
                    position:absolute;
                    right:0;
                    top:0;
                    font-size:80%;
                    color:yellow;
                }
            </style>
            <div class="task-swimlane-list-item-title">${title}</div>
            <div class="task-swimlane-list-item-parent">${parentTitle}</div>
            <div class="task-swimlane-list-item-deadline">${deadline}</div>
            <div class="task-swimlane-list-item-tags"></div>
        </div>
`};

const getCardTPL = (noteId) => { return `
<div class="swimlane-book-card-${noteId}">
<style>
.swimlane-list.grid-view .swimlane-book-card-${noteId} {
    flex-basis: 300px;
    border: 1px solid transparent;
}
.swimlane-list.grid-view .swimlane-book-card-${noteId} {
    max-height: 1200px;
}

.swimlane-list.grid-view .swimlane-book-card-${noteId} img {
    max-height: 220px;
    object-fit: contain;
}

.swimlane-book-card-${noteId} {
    border-radius: 10px;
    background-color: var(--accented-background-color);
    padding: 10px 15px 15px 8px;
    margin: 5px 5px 5px 5px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    flex-grow: 1;
}

.swimlane-book-card-${noteId}:not(.expanded) .swimlane-book-content {
    display: none !important;
    padding: 10px
}

.swimlane-book-card-${noteId}.expanded .swimlane-book-content {
    border: 2px solid black;
    background-color: var(--main-background-color);
    display: block;
    min-height: 0;
    height: 100%;
    padding-top: 10px;
}
/* not-expanded title is limited to one line only */
.swimlane-book-card-${noteId}:not(.expanded) .swimlane-book-header {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.swimlane-book-card-${noteId} .swimlane-book-card-${noteId} {
    border: 1px solid var(--main-border-color);
}
.swimlane-book-header .rendered-swimlane-attributes {
    font-size: medium;
}
.swimlane-book-card-${noteId}.type-image .swimlane-book-content img,
.swimlane-book-card-${noteId}.type-text .swimlane-book-content img,
.swimlane-book-card-${noteId}.type-canvas .swimlane-book-content img {
    max-width: 100%;
    max-height: 100%;
}
</style>
</div>
`};

const TPL = `
<div class="swimlane-list">
    <style>
    .swimlane-list {
        overflow: hidden;
        position: relative;
        height: 100%;
    }

    .swimlane-list.grid-view .swimlane-list-container {
        display: flex;
        flex-wrap: wrap;
    }

    .swimlane-list.grid-view .swimlane-expander {
        display: none;
    }

    .swimlane-book-content .rendered-content {
        height: 100%;
        overflow: scroll;
        -webkit-scrollbar: none;
        -ms-overflow-style: none;
        scrollbar-width: none;
    }

    .swimlane-book-header {
        border-bottom: 1px solid var(--main-border-color);
        position:relative;
        margin-bottom: 0;
        flex-direction:row;
        padding-bottom: .5rem;
        word-break: break-all;
    }

   
    .swimlane-book-header .rendered-swimlane-attributes:before {
        content: "\\00a0\\00a0";
    }

    .swimlane-book-header .swimlane-icon {
        font-size: 100%;
        display: inline-block;
        padding-right: 7px;
        position: relative;
    }

    .swimlane-book-content.type-image, .swimlane-book-content.type-file, .swimlane-book-content.type-protectedSession {
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 10px;
    }

    .swimlane-book-content.type-image img, .swimlane-book-content.type-canvas svg {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }

    .swimlane-book-title-limit {
        position:absolute;
        right:0;
        margin: auto 0;
    }

    .swimlane-book-header.input[type="checkbox"]:checked + .swimlane-book-content {
        display: none;
    }

    @keyframes task-swimlane-list-item-deadline-blinker {
        0%{
            color:red;
        }
        50%{
            color:orange;
        }
    }

    .swimlane-book-header {
        flex-grow: 0;
    }

    .swimlane-list-wrapper {
        height: 100%;
        overflow: auto;
    }

    .swimlane-expander {
        font-size: x-large;
        position: relative;
        top: 3px;
        cursor: pointer;
    }

    .swimlane-list-pager {
        text-align: center;
    }
    </style>

    <div class="swimlane-list-wrapper">
        <div class="swimlane-list-pager"></div>

        <div class="swimlane-list-container"></div>

        <div class="swimlane-list-pager"></div>
    </div>
</div>`;

class SwimlaneListRenderer {
    /*
     * We're using noteIds so that it's not necessary to load all notes at once when paging
     */
    constructor($parentDOM, $parent) {
        this.$noteList = $(TPL);

        // note list must be added to the DOM immediately, otherwise some functionality scripting (canvas) won't work
        $parentDOM.empty();

        this.parentNote = $parent;
        const includedSwimlanes = this.getIncludedSwimlanes();
        const noteIds = $parent.getChildNoteIds();

        this.noteIds = noteIds.filter(noteId => !includedSwimlanes.has(noteId) && noteId !== '_hidden');

        if (this.noteIds.length === 0) {
            return;
        }

        $parentDOM.append(this.$noteList);

        this.page = 1;
        this.pageSize = parseInt($parent.getLabelValue('pageSize'));

        if (!this.pageSize || this.pageSize < 1) {
            this.pageSize = 20;
        }

        this.viewType = $parent.getLabelValue('viewType');

        if (!['list', 'grid'].includes(this.viewType)) {
            // when not explicitly set, decide based on the note type
            this.viewType = $parent.type === 'search' ? 'list' : 'grid';
        }

        this.$noteList.addClass(`${this.viewType}-view`);

        this.showNotePath = true;
    }

    /** @returns {Set<string>} list of noteIds included (images, included notes) in the parent note and which
     *                        don't have to be shown in the note list. */
    getIncludedSwimlanes() {
        const includedLinks = this.parentNote
            ? this.parentNote.getRelations().filter(rel => rel.name === 'imageLink' || rel.name === 'includeNoteLink')
            : [];

        return new Set(includedLinks.map(rel => rel.value));
    }

    async renderList() {
        if (this.parentNote.type !== 'swimlane_dashboard' || this.noteIds.length === 0) {
            this.$noteList.hide();
            return;
        }

        this.swimlanes = {};

        const highlightedTokens = this.parentNote.highlightedTokens || [];
        if (highlightedTokens.length > 0) {
            await libraryLoader.requireLibrary(libraryLoader.MARKJS);

            this.highlightRegex = new RegExp(highlightedTokens.join("|"), 'gi');
        } else {
            this.highlightRegex = null;
        }

        this.$noteList.show();

        const $container = this.$noteList.find('.swimlane-list-container').empty();

        const startIdx = (this.page - 1) * this.pageSize;
        const endIdx = startIdx + this.pageSize;

        const pageNoteIds = this.noteIds.slice(startIdx, Math.min(endIdx, this.noteIds.length));
        const pageNotes = await froca.getNotes(pageNoteIds);

        for (const note of pageNotes) {
            const $card = await this.renderNote(note, this.parentNote.isLabelTruthy('expanded'));

            $container.append($card);
        }

        this.renderPager();

        return this.$noteList;
    }

    renderPager() {
        const $pager = this.$noteList.find('.swimlane-list-pager').empty();
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
        const {$renderedAttributes} = await attributeRenderer.renderNormalAttributes(note);
        
        const noteHeader = `
        <div>
            <style>
                .swimlane-book-header-toggle-label-${note.noteId} {
                    display: block;
                    position:relative;
                }
                
                .swimlane-book-header-toggle-input-${note.noteId} {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }

                .swimlane-book-title-${note.noteId} {
                    width:100%;
                }

                .swimlane-book-header-toggle-label-${note.noteId}:hover {
                    cursor:pointer;
                    user-select: none;
                }

                .swimlane-book-header-limit-${note.noteId} {
                    position:absolute;
                    right:0;
                    bottom:0;
                }

            </style>
            <label class="swimlane-book-header-toggle-label-${note.noteId}">
                <input class="swimlane-book-header-toggle-input-${note.noteId}" type="checkbox">
                <span class="swimlane-icon ${note.getIcon()}"></span>
                <span class="swimlane-book-title-${note.noteId}">${note.title}</span>
                <span class="swimlane-book-header-limit-${note.noteId}"></span>
            </label>
        </div>
        `;

        const title = $(noteHeader);
        const $card = $(getCardTPL(note.noteId))
            .attr('data-swimlane-id', note.noteId)
            .append(
                title
                   .append($renderedAttributes)
            );

        await this.toggleContent($card, note, expand);

        title.on('change', () => {
            const input = title.find('input');
            if (input[0].checked) {
                $card.find('.type-swimlane').hide();
            } else {
                $card.find('.type-swimlane').show();
            }
        });
        
        return $card;
    }

    async toggleContent($card, note, expand) {
        if (this.viewType === 'list' && ((expand && $card.hasClass("expanded")) || (!expand && !$card.hasClass("expanded")))) {
            return;
        }

        const $expander = $card.find('> .swimlane-book-header .swimlane-expander');

        if (expand || this.viewType === 'grid') {
            $card.addClass("expanded");
            $expander.addClass("bx-chevron-down").removeClass("bx-chevron-right");
        }
        else {
            $card.removeClass("expanded");
            $expander.addClass("bx-chevron-right").removeClass("bx-chevron-down");
        }

        if ((expand || this.viewType === 'grid') && $card.find('.swimlane-book-content').length === 0) {
            $card.append(await this.renderNoteContent(note.noteId));
        }
    }

    async renderSwimlaneItem(item, renderedContent, index) {

        const addPriorityTag = (parent, priority) => {
            switch (priority) {
                case "urgent":
                    addTag(parent, "HIGH PRIO", "#e34242");
                    return;
                
                case "show_stopper":
                    addTag(parent, "BLOCKER", "#9e0606");
                    return;
                default:
                    break;
            }
        };
    
        const addStatusTag = (parent, item) => {
            const status = item['status'];
            switch (status) {
                case "default":
                    addTag(parent, "IN QUEUE", "#0088ff");
                    break;
                    
                case "postponed":
                    addTag(parent, "POSTPONED", "yellow");
                    break;
            
                case "blocked":
                    addTag(parent, "BLOCKED", "orange");
                    break;
                
                case "done": 
                    addTag(parent, "DONE", "#00ff00");
                    break;
                default:
                    break;
            }
        };
    
        const addTag = (element, text, color) => {
            const tag = $(`<span class="task-swimlane-list-item-tag" title="${text}">${text}</span>`); 
            tag.css('border-color', color);
            tag.css('background-color', color);
            element.append(tag);
        };
    
        const prepareDeadline = (element, deadline) => {
            if (deadline === undefined || deadline === '1999-01-01') {
                element.hide();
            } else {
                const diff = dayjs(deadline).diff(dayjs(), 'day');
                if (diff <= 0) {
                    element.attr('severity', 'HOLYCOW');
                } else if (diff < 3) {
                    element.attr('severity', 'REDZONE');
                } else if (diff < 7) {
                    element.attr('severity', 'CAUTION'); 
                } 
            }
        };
    
        const addTags = (parentElement, data) => {
            addStatusTag(parentElement, data);
            addPriorityTag(parentElement, priority);
        };
    
        const title = item['title'];
        const priority = item['priority'];
        const href = item['href'];
        const taskId = item['taskId'];
        const deadline = item['deadline'];
        const styleSuffix = `${taskId}-${index}`;
        const parents = await froca.getParentNotes(taskId);
        const parent = await froca.getNote(parents[0]);
        
        const swimlaneItem = $(getSwimlaneTPL(styleSuffix, title, parent.title, deadline));
        swimlaneItem
            .addClass('block-link')
            .attr('data-href', `#${href}`)
            .on('click', e => linkService.goToLink(e));
        const tagsParent = swimlaneItem.find('.task-swimlane-list-item-tags');
        
        prepareDeadline(swimlaneItem.find('.task-swimlane-list-item-deadline'), deadline);
        addTags(tagsParent, item);
        
        renderedContent.append(swimlaneItem);
    }

    async getSwimlaneTasks(swimlaneId) {
        const renderedContent = $('<div class="rendered-content">');
        const tasks = await taskService.getSwimlaneTasks(swimlaneId, true);
        var ind = 0;
        for (const i in tasks) {
            const newGrouping = $(`<div>`);
            if (tasks[i].length > 1) {
                newGrouping.addClass('task-swimlane-list-item-group');
            }
            for(const j in tasks[i]){
                await this.renderSwimlaneItem(tasks[i][j], newGrouping, ind++);
            }
            renderedContent.append(newGrouping);
        }

        this.swimlanes[swimlaneId] = tasks.flat().map(a => a['taskId']);
        
        return renderedContent;
    }

    async applySwimlaneUpdates(swimlaneId, updatedTaskId, updatedProp, newValue) {
        const parentCard = this.$noteList?.find(`.swimlane-book-card-innercontent-${swimlaneId}`);
        parentCard?.children()?.last().remove();
        parentCard.append(await this.getSwimlaneTasks(swimlaneId));
    }

    async renderNoteContent(noteId) {
        const $content = $(`<div class="swimlane-book-content swimlane-book-card-innercontent-${noteId}">`);

        try {
            const $renderedContent = await this.getSwimlaneTasks(noteId);

            $content.append($renderedContent);
            $content.addClass(`type-swimlane`);
        } catch (e) {
            console.log(`Caught error while rendering note '${noteId}' of type swimlane: ${e.message}, stack: ${e.stack}`);

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

    async taskTitleUpdatedEvent(e) {
        Object.entries(this.swimlanes).forEach(([swimlaneId, taskIds]) => {
            if (taskIds.includes(e.taskId)) {
                this.applySwimlaneUpdates(swimlaneId, e.noteId, "title", e.newTitle);
            }
        });
    }

    async taskPropUpdatedEvent(e) {
        Object.entries(this.swimlanes).forEach(([swimlaneId, taskIds]) => {
            if (taskIds.includes(e.taskId)) {
                this.applySwimlaneUpdates(swimlaneId, e.taskId, e.prop, e.newValue);
            }
        });
    }
}

export default SwimlaneListRenderer;
