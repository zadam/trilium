import treeService from "./tree.js";
import linkService from "./link.js";
import froca from "./froca.js";
import utils from "./utils.js";
import attributeRenderer from "./attribute_renderer.js";
import contentRenderer from "./content_renderer.js";
import appContext from "../components/app_context.js";

function setupGlobalTooltip() {
    $(document).on("mouseenter", "a", mouseEnterHandler);

    // close any note tooltip after click, this fixes the problem that sometimes tooltips remained on the screen
    $(document).on("click", e => {
        if ($(e.target).closest(".note-tooltip").length) {
            // click within the tooltip shouldn't close it
            return;
        }

        $('.note-tooltip').remove();
    });
}

function setupElementTooltip($el) {
    $el.on('mouseenter', mouseEnterHandler);
}

async function mouseEnterHandler() {
    const $link = $(this);

    if ($link.hasClass("no-tooltip-preview") || $link.hasClass("disabled")) {
        return;
    } else if ($link.closest(".ck-link-actions").length) {
        // this is to avoid showing tooltip from inside the CKEditor link editor dialog
        return;
    } else if ($link.closest(".note-tooltip").length) {
        // don't show tooltip for links within tooltip
        return;
    }

    const url = $link.attr("href") || $link.attr("data-href");
    const { notePath, noteId, viewScope } = linkService.parseNavigationStateFromUrl(url);

    if (!notePath || viewScope.viewMode !== 'default') {
        return;
    }

    const linkId = $link.attr("data-link-id") || `link-${Math.floor(Math.random() * 1000000)}`;
    $link.attr("data-link-id", linkId);

    if ($(`.${linkId}`).is(":visible")) {
        // tooltip is already open for this link
        return;
    }

    const note = await froca.getNote(noteId);

    const [content] = await Promise.all([
        renderTooltip(note),
        // to reduce flicker due to accidental mouseover, cursor must stay for a bit over the link for tooltip to appear
        new Promise(res => setTimeout(res, 500))
    ]);

    if (utils.isHtmlEmpty(content)) {
        return;
    }

    const html = `<div class="note-tooltip-content">${content}</div>`;
    const tooltipClass = 'tooltip-' + Math.floor(Math.random() * 999_999_999);

    // we need to check if we're still hovering over the element
    // since the operation to get tooltip content was async, it is possible that
    // we now create tooltip which won't close because it won't receive mouseleave event
    if ($(this).filter(":hover").length > 0) {
        $(this).tooltip({
            container: 'body',
            // https://github.com/zadam/trilium/issues/2794 https://github.com/zadam/trilium/issues/2988
            // with bottom this flickering happens a bit less
            placement: 'bottom',
            trigger: 'manual',
            boundary: 'window',
            title: html,
            html: true,
            template: `<div class="tooltip note-tooltip ${tooltipClass}" role="tooltip"><div class="arrow"></div><div class="tooltip-inner"></div></div>`,
            sanitize: false,
            customClass: linkId
        });

        $(this).tooltip('show');

        // the purpose of the code below is to:
        // - allow user to go from hovering the link to hovering the tooltip to be able to scroll,
        //   click on links within tooltip etc. without tooltip disappearing
        // - once the user moves the cursor away from both link and the tooltip, hide the tooltip
        const checkTooltip = () => {
            if (!$(`.${tooltipClass}`).is(':visible')) {
                console.log("Not visible anymore");

                return;
            }

            if (!$(this).filter(":hover").length && !$(`.${linkId}:hover`).length) {
                // cursor is neither over the link nor over the tooltip, user likely is not interested
                $(this).tooltip('dispose');
            } else {
                setTimeout(checkTooltip, 1000);
            }
        }

        setTimeout(checkTooltip, 1000);
    }
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
