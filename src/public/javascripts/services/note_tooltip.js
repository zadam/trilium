import treeService from "./tree.js";
import linkService from "./link.js";
import treeCache from "./tree_cache.js";
import utils from "./utils.js";

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

    const note = await treeCache.getNote(noteId);
    const noteComplement = await treeCache.getNoteComplement(noteId);

    const html = await renderTooltip(note, noteComplement);

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

async function renderTooltip(note, noteComplement) {
    if (note.isDeleted) {
        return '<div>Note has been deleted.</div>';
    }

    const attributes = note.getAttributes();

    let content = '';

    const promoted = attributes
        .filter(attr => attr.type === 'label-definition' || attr.type === 'relation-definition')
        .filter(attr => !attr.name.startsWith("child:"))
        .filter(attr => {
            const json = attr.jsonValue;

            return json && json.isPromoted;
        });

    if (promoted.length > 0) {
        const $table = $("<table>").addClass("promoted-attributes-in-tooltip");

        for (const definitionAttr of promoted) {
            const definitionType = definitionAttr.type;
            const valueType = definitionType.substr(0, definitionType.length - 11);

            let valueAttrs = attributes.filter(el => el.name === definitionAttr.name && el.type === valueType);

            for (const valueAttr of valueAttrs) {
                if (!valueAttr.value) {
                    continue;
                }

                let $value = "";

                if (valueType === 'label') {
                    $value = $("<td>").text(valueAttr.value);
                }
                else if (valueType === 'relation' && valueAttr.value) {
                    $value = $("<td>").append(await linkService.createNoteLink(valueAttr.value));
                }

                const $row = $("<tr>")
                    .append($("<th>").text(definitionAttr.name))
                    .append($value);

                $table.append($row);
            }
        }

        content += $table.prop('outerHTML');
    }

    if (note.type === 'text' && !utils.isHtmlEmpty(noteComplement.content)) {
        content += '<div class="ck-content">' + noteComplement.content + '</div>';
    }
    else if (note.type === 'code' && noteComplement.content && noteComplement.content.trim()) {
        content += $("<pre>")
            .text(noteComplement.content)
            .prop('outerHTML');
    }
    else if (note.type === 'image') {
        content += $("<img>")
            .prop("src", `api/images/${note.noteId}/${note.title}`)
            .prop('outerHTML');
    }
    // other types of notes don't have tooltip preview

    return content;
}

export default {
    setupGlobalTooltip,
    setupElementTooltip
}