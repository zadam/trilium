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

let idCounter = 1;

/**
 * @param {FNote|FAttachment} entity
 * @param {object} options
 * @return {Promise<{type: string, $renderedContent: jQuery}>}
 */
async function getRenderedContent(entity, options = {}) {
    options = Object.assign({
        trim: false,
        tooltip: false
    }, options);

    const type = getRenderingType(entity);
    // attachment supports only image and file/pdf/audio/video

    const $renderedContent = $('<div class="rendered-content">');

    if (type === 'text') {
        await renderText(entity, options, $renderedContent);
    }
    else if (type === 'code') {
        await renderCode(entity, options, $renderedContent);
    }
    else if (type === 'image') {
        renderImage(entity, $renderedContent);
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
                .css("text-align", "center")
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

async function renderText(note, options, $renderedContent) {
    // entity must be FNote
    const blob = await note.getBlob({preview: options.trim});

    if (!utils.isHtmlEmpty(blob.content)) {
        $renderedContent.append($('<div class="ck-content">').html(trim(blob.content, options.trim)));

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

async function renderCode(note, options, $renderedContent) {
    const blob = await note.getBlob({preview: options.trim});

    $renderedContent.append($("<pre>").text(trim(blob.content, options.trim)));
}

function renderImage(entity, $renderedContent) {
    const sanitizedTitle = entity.title.replace(/[^a-z0-9-.]/gi, "");

    let url;

    if (entity instanceof FNote) {
        url = `api/images/${entity.noteId}/${sanitizedTitle}?${entity.utcDateModified}`;
    } else if (entity instanceof FAttachment) {
        url = `api/attachments/${entity.attachmentId}/image/${sanitizedTitle}?${entity.utcDateModified}">`;
    }

    $renderedContent.append(
        $("<img>")
            .attr("src", url)
            .css("max-width", "100%")
    );
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
            .attr("src", openService.getUrlForStreaming(`api/${entityType}/${entityId}/open-partial`))
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
        mermaid.mermaidAPI.render("in-mermaid-graph-" + idCounter++, content,
            content => $renderedContent.append($(content)));
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

function trim(text, doTrim) {
    if (!doTrim) {
        return text;
    }
    else {
        return text.substr(0, Math.min(text.length, 2000));
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
