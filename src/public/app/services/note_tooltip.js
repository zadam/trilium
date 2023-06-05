import treeService from "./tree.js";
import linkService from "./link.js";
import froca from "./froca.js";
import utils from "./utils.js";
import attributeRenderer from "./attribute_renderer.js";
import contentRenderer from "./content_renderer.js";
import appContext from "../components/app_context.js";

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
        || $link.hasClass("disabled")) {
        return;
    }

    // this is to avoid showing tooltip from inside the CKEditor link editor dialog
    if ($link.closest(".ck-link-actions").length) {
        return;
    }

    const url = $link.attr("href") || $link.attr("data-href");
    const { notePath, noteId, viewScope } = linkService.parseNavigationStateFromUrl(url);

    if (!notePath || viewScope.viewMode !== 'default') {
        return;
    }

    const note = await froca.getNote(noteId);
    const content = await renderTooltip(note);

    if (utils.isHtmlEmpty(content)) {
        return;
    }

    const html = `<div class="note-tooltip-content">${content}</div>`;

    // we need to check if we're still hovering over the element
    // since the operation to get tooltip content was async, it is possible that
    // we now create tooltip which won't close because it won't receive mouseleave event
    if ($(this).is(":hover")) {
        $(this).tooltip({
            delay: {"show": 300, "hide": 100},
            container: 'body',
            // https://github.com/zadam/trilium/issues/2794 https://github.com/zadam/trilium/issues/2988
            // with bottom this flickering happens a bit less
            placement: 'bottom',
            trigger: 'manual',
            boundary: 'window',
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
    if (!note) {
        return '<div>Note has been deleted.</div>';
    }

    const hoistedNoteId = appContext.tabManager.getActiveContext()?.hoistedNoteId;
    const bestNotePath = note.getBestNotePathString(hoistedNoteId);

    if (!bestNotePath) {
        return;
    }

    let content = `<h5 class="note-tooltip-title">${(await treeService.getNoteTitleWithPathAsSuffix(bestNotePath)).prop('outerHTML')}</h5>`;

    const {$renderedAttributes} = await attributeRenderer.renderNormalAttributes(note);

    const {$renderedContent} = await contentRenderer.getRenderedContent(note, {
        tooltip: true,
        trim: true
    });

    content = `${content}<div class="note-tooltip-attributes">${$renderedAttributes[0].outerHTML}</div>${$renderedContent[0].outerHTML}`;

    return content;
}

export default {
    setupGlobalTooltip,
    setupElementTooltip
}
