import renderService from "./render.js";
import protectedSessionService from "./protected_session.js";
import protectedSessionHolder from "./protected_session_holder.js";
import libraryLoader from "./library_loader.js";
import openService from "./open.js";
import froca from "./froca.js";
import utils from "./utils.js";
import linkService from "./link.js";
import treeService from "./tree.js";
import FNote from "../entities/fnote.js";
import FAttachment from "../entities/fattachment.js";
import task from "./task.js";
let idCounter = 1;

/**
 * @param {FNote|FAttachment} entity
 * @param {object} options
 * @return {Promise<{type: string, $renderedContent: jQuery}>}
 */
async function getRenderedContent(entity, options = {}) {
    options = Object.assign({
        tooltip: false
    }, options);

    const type = getRenderingType(entity);
    // attachment supports only image and file/pdf/audio/video

    const $renderedContent = $('<div class="rendered-content">');

    if (type === 'text') {
        await renderText(entity, $renderedContent);
    }
    else if (type === 'code') {
        await renderCode(entity, options, $renderedContent);
    }
    else if (type === 'image') {
        renderImage(entity, $renderedContent, options);
    }
    else if (!options.tooltip && ['file', 'pdf', 'audio', 'video'].includes(type)) {
        renderFile(entity, type, $renderedContent);
    }
    else if (type === 'mermaid') {
        await renderMermaid(entity, $renderedContent);
    }
    else if (type === 'render') {
        const $content = $('<div>');

        await renderService.render(entity, $content, this.ctx);

        $renderedContent.append($content);
    }
    else if (type === 'swimlane') {
        await renderSwimlane(entity, $renderedContent);
    }
    else if (type === 'canvas') {
        await renderCanvas(entity, $renderedContent);
    }
    else if (!options.tooltip && type === 'protectedSession') {
        const $button = $(`<button class="btn btn-sm"><span class="bx bx-log-in"></span> Enter protected session</button>`)
            .on('click', protectedSessionService.enterProtectedSession);

        $renderedContent.append(
            $("<div>")
                .append("<div>This note is protected and to access it you need to enter password.</div>")
                .append("<br/>")
                .append($button)
        );
    }
    else if (entity instanceof FNote) {
        $renderedContent.append(
            $("<div>")
                .css("display", "flex")
                .css("justify-content", "space-around")
                .css("align-items", "center")
                .css("height", "100%")
                .css("font-size", "500%")
                .append($("<span>").addClass(entity.getIcon()))
        );
    }

    if (entity instanceof FNote) {
        $renderedContent.addClass(entity.getCssClass());
    }

    return {
        $renderedContent,
        type
    };
}

async function renderSwimlaneItem(item, renderedContent, index) {

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
    
    const newTPL = `
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
        <div class="task-swimlane-list-item-parent">${parent.title}</div>
        <div class="task-swimlane-list-item-deadline">${deadline}</div>
        <div class="task-swimlane-list-item-tags"></div>
    </div>
    `;

    const swimlaneItem = $(newTPL);
    swimlaneItem
        .addClass('block-link')
        .attr('data-href', `#${href}`)
        .on('click', e => linkService.goToLink(e));
    const tagsParent = swimlaneItem.find('.task-swimlane-list-item-tags');
    
    prepareDeadline(swimlaneItem.find('.task-swimlane-list-item-deadline'), deadline);
    addTags(tagsParent, item);
    
    renderedContent.append(swimlaneItem);
}

async function renderSwimlane(note, renderedContent) {
    const tasks = await task.getSwimlaneTasks(note.noteId, true);
    var ind = 0;
    for (const i in tasks) {
        const newGrouping = $(`<div>`);
        if (tasks[i].length > 1) {
            newGrouping.addClass('task-swimlane-list-item-group');
        }
        for(const j in tasks[i]){
            await renderSwimlaneItem(tasks[i][j], newGrouping, ind++);
        }
        renderedContent.append(newGrouping);
    }
}

/** @param {FNote} note */
async function renderText(note, $renderedContent) {
    // entity must be FNote
    const blob = await note.getBlob();

    if (!utils.isHtmlEmpty(blob.content)) {
        $renderedContent.append($('<div class="ck-content">').html(blob.content));

        if ($renderedContent.find('span.math-tex').length > 0) {
            await libraryLoader.requireLibrary(libraryLoader.KATEX);

            renderMathInElement($renderedContent[0], {trust: true});
        }

        const getNoteIdFromLink = el => treeService.getNoteIdFromUrl($(el).attr('href'));
        const referenceLinks = $renderedContent.find("a.reference-link");
        const noteIdsToPrefetch = referenceLinks.map(el => getNoteIdFromLink(el));
        await froca.getNotes(noteIdsToPrefetch);

        for (const el of referenceLinks) {
            await linkService.loadReferenceLinkTitle($(el));
        }
    } else {
        await renderChildrenList($renderedContent, note);
    }
}

/** @param {FNote} note */
async function renderCode(note, $renderedContent) {
    const blob = await note.getBlob();

    $renderedContent.append($("<pre>").text(blob.content));
}

function renderImage(entity, $renderedContent, options = {}) {
    const sanitizedTitle = entity.title.replace(/[^a-z0-9-.]/gi, "");

    let url;

    if (entity instanceof FNote) {
        url = `api/images/${entity.noteId}/${sanitizedTitle}?${entity.utcDateModified}`;
    } else if (entity instanceof FAttachment) {
        url = `api/attachments/${entity.attachmentId}/image/${sanitizedTitle}?${entity.utcDateModified}">`;
    }

    $renderedContent // styles needed for the zoom to work well
        .css('display', 'flex')
        .css('align-items', 'center')
        .css('justify-content', 'center');

    const $img = $("<img>")
        .attr("src", url)
        .attr("id", "attachment-image-" + idCounter++)
        .css("max-width", "100%");

    $renderedContent.append($img);

    if (options.imageHasZoom) {
        libraryLoader.requireLibrary(libraryLoader.WHEEL_ZOOM).then(() => {
            WZoom.create(`#${$img.attr("id")}`, {
                maxScale: 50,
                speed: 1.3,
                zoomOnClick: false
            });
        });
    }
}

function renderFile(entity, type, $renderedContent) {
    let entityType, entityId;

    if (entity instanceof FNote) {
        entityType = 'notes';
        entityId = entity.noteId;
    } else if (entity instanceof FAttachment) {
        entityType = 'attachments';
        entityId = entity.attachmentId;
    } else {
        throw new Error(`Can't recognize entity type of '${entity}'`);
    }

    const $content = $('<div style="display: flex; flex-direction: column; height: 100%;">');

    if (type === 'pdf') {
        const $pdfPreview = $('<iframe class="pdf-preview" style="width: 100%; flex-grow: 100;"></iframe>');
        $pdfPreview.attr("src", openService.getUrlForDownload(`api/${entityType}/${entityId}/open`));

        $content.append($pdfPreview);
    } else if (type === 'audio') {
        const $audioPreview = $('<audio controls></audio>')
            .attr("src", openService.getUrlForDownload(`api/${entityType}/${entityId}/open-partial`))
            .attr("type", entity.mime)
            .css("width", "100%");

        $content.append($audioPreview);
    } else if (type === 'video') {
        const $videoPreview = $('<video controls></video>')
            .attr("src", openService.getUrlForDownload(`api/${entityType}/${entityId}/open-partial`))
            .attr("type", entity.mime)
            .css("width", "100%");

        $content.append($videoPreview);
    }

    if (entityType === 'notes') {
        // TODO: we should make this available also for attachments, but there's a problem with "Open externally" support
        //       in attachment list
        const $downloadButton = $('<button class="file-download btn btn-primary" type="button">Download</button>');
        const $openButton = $('<button class="file-open btn btn-primary" type="button">Open</button>');

        $downloadButton.on('click', () => openService.downloadFileNote(entity.noteId));
        $openButton.on('click', () => openService.openNoteExternally(entity.noteId, entity.mime));
        // open doesn't work for protected notes since it works through a browser which isn't in protected session
        $openButton.toggle(!entity.isProtected);

        $content.append(
            $('<div style="display: flex; justify-content: space-evenly; margin-top: 5px;">')
                .append($downloadButton)
                .append($openButton)
        );
    }

    $renderedContent.append($content);
}

async function renderMermaid(note, $renderedContent) {
    await libraryLoader.requireLibrary(libraryLoader.MERMAID);

    const blob = await note.getBlob();
    const content = blob.content || "";

    $renderedContent
        .css("display", "flex")
        .css("justify-content", "space-around");

    const documentStyle = window.getComputedStyle(document.documentElement);
    const mermaidTheme = documentStyle.getPropertyValue('--mermaid-theme');

    mermaid.mermaidAPI.initialize({startOnLoad: false, theme: mermaidTheme.trim(), securityLevel: 'antiscript'});

    try {
        const {svg} = await mermaid.mermaidAPI.render("in-mermaid-graph-" + idCounter++, content);

        $renderedContent.append($(svg));
    } catch (e) {
        const $error = $("<p>The diagram could not displayed.</p>");

        $renderedContent.append($error);
    }
}

async function renderCanvas(note, $renderedContent) {
    // make sure surrounding container has size of what is visible. Then image is shrinked to its boundaries
    $renderedContent.css({height: "100%", width: "100%"});

    const blob = await note.getBlob();
    const content = blob.content || "";

    try {
        const placeHolderSVG = "<svg />";
        const data = JSON.parse(content)
        const svg = data.svg || placeHolderSVG;
        /**
         * maxWidth: size down to 100% (full) width of container but do not enlarge!
         * height:auto to ensure that height scales with width
         */
        $renderedContent.append($(svg).css({maxWidth: "100%", maxHeight: "100%", height: "auto", width: "auto"}));
    } catch (err) {
        console.error("error parsing content as JSON", content, err);
        $renderedContent.append($("<div>").text("Error parsing content. Please check console.error() for more details."));
    }
}

/**
 * @param {jQuery} $renderedContent
 * @param {FNote} note
 * @returns {Promise<void>}
 */
async function renderChildrenList($renderedContent, note) {
    $renderedContent.css("padding", "10px");
    $renderedContent.addClass("text-with-ellipsis");

    let childNoteIds = note.getChildNoteIds();

    if (childNoteIds.length > 10) {
        childNoteIds = childNoteIds.slice(0, 10);
    }

    // just load the first 10 child notes
    const childNotes = await froca.getNotes(childNoteIds);

    for (const childNote of childNotes) {
        $renderedContent.append(await linkService.createLink(`${note.noteId}/${childNote.noteId}`, {
            showTooltip: false,
            showNoteIcon: true
        }));

        $renderedContent.append("<br>");
    }
}

function getRenderingType(entity) {
    let type = entity.type || entity.role;
    const mime = entity.mime;

    if (type === 'file' && mime === 'application/pdf') {
        type = 'pdf';
    } else if (type === 'file' && mime.startsWith('audio/')) {
        type = 'audio';
    } else if (type === 'file' && mime.startsWith('video/')) {
        type = 'video';
    }

    if (entity.isProtected) {
        if (protectedSessionHolder.isProtectedSessionAvailable()) {
            protectedSessionHolder.touchProtectedSession();
        }
        else {
            type = 'protectedSession';
        }
    }

    return type;
}

export default {
    getRenderedContent
};
