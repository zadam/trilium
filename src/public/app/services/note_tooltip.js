import treeService from "./tree.js";
import linkService from "./link.js";
import froca from "./froca.js";
import utils from "./utils.js";
import attributeRenderer from "./attribute_renderer.js";
import noteContentRenderer from "./note_content_renderer.js";

function setupGlobalTooltip() {
    $(document).on("mouseenter", "a", mouseEnterHandler);
    $(document).on("mouseleave", "a", mouseLeaveHandler);

    // close any note tooltip after click, this fixes the problem that sometimes tooltips remained on the screen
    $(document).on("click", () => $('.note-tooltip').remove());
}

function setupElementTooltip($el) {
    $el.on('mouseenter', mouseEnterHandler);
    $el.on('mouseleave', mouseLeaveHandler);
}

async function mouseEnterHandler() {
    const $link = $(this);

    if ($link.hasClass("no-tooltip-preview")
        || $link.hasClass("disabled")
        || $link.attr("data-action") === 'note-revision') {
        return;
    }

    // this is to avoid showing tooltip from inside CKEditor link editor dialog
    if ($link.closest(".ck-link-actions").length) {
        return;
    }

    let notePath = linkService.getNotePathFromUrl($link.attr("href"));

    if (!notePath) {
        notePath = $link.attr("data-note-path");
    }

    if (!notePath) {
        return;
    }

    const noteId = treeService.getNoteIdFromNotePath(notePath);

    const note = await froca.getNote(noteId);
    const content = await renderTooltip(note);

    if (utils.isHtmlEmpty(content)) {
        return;
    }

    const html = '<div class="note-tooltip-content">' + content + '</div>';

    // we need to check if we're still hovering over the element
    // since the operation to get tooltip content was async, it is possible that
    // we now create tooltip which won't close because it won't receive mouseleave event
    if ($(this).is(":hover")) {
        $(this).tooltip({
            delay: {"show": 300, "hide": 100},
            container: 'body',
            placement: 'auto',
            trigger: 'manual',
            boundary: 'window',
            offset: "0, 20", // workaround for https://github.com/zadam/trilium/issues/2794
            title: html,
            html: true,
            template: '<div class="tooltip note-tooltip" role="tooltip"><div class="arrow"></div><div class="tooltip-inner"></div></div>',
            sanitize: false
        });

        $(this).tooltip('show');
    }
}

function mouseLeaveHandler() {
    $(this).tooltip('dispose');
}

async function renderTooltip(note) {
    if (note.isDeleted) {
        return '<div>Note has been deleted.</div>';
    }

    const someNotePath = treeService.getSomeNotePath(note);

    if (!someNotePath) {
        return;
    }

    let content = '<h5 class="note-tooltip-title">' + (await treeService.getNoteTitleWithPathAsSuffix(someNotePath)).prop('outerHTML') + '</h5>';

    const {$renderedAttributes} = await attributeRenderer.renderNormalAttributes(note);

    const {$renderedContent} = await noteContentRenderer.getRenderedContent(note, {
        tooltip: true,
        trim: true
    });

    content = content
        + '<div class="note-tooltip-attributes">' + $renderedAttributes[0].outerHTML + '</div>'
        + $renderedContent[0].outerHTML;

    return content;
}

export default {
    setupGlobalTooltip,
    setupElementTooltip
}
