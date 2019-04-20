import noteDetailService from "./note_detail.js";
import treeUtils from "./tree_utils.js";
import linkService from "./link.js";
import server from "./server.js";

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

    if ($link.hasClass("no-tooltip-preview") || $link.hasClass("disabled")) {
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

    const noteId = treeUtils.getNoteIdFromNotePath(notePath);

    const notePromise = noteDetailService.loadNote(noteId);
    const attributePromise = server.get('notes/' + noteId + '/attributes');

    const [note, attributes] = await Promise.all([notePromise, attributePromise]);

    const html = await renderTooltip(note, attributes);

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
            template: '<div class="tooltip note-tooltip" role="tooltip"><div class="arrow"></div><div class="tooltip-inner"></div></div>'
        });

        $(this).tooltip('show');
    }
}

function mouseLeaveHandler() {
    $(this).tooltip('dispose');
}

async function renderTooltip(note, attributes) {
    let content = '';
    const promoted = attributes.filter(attr =>
        (attr.type === 'label-definition' || attr.type === 'relation-definition')
        && !attr.name.startsWith("child:")
        && attr.value.isPromoted);

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

    if (note.type === 'text') {
        // surround with <div> for a case when note's content is pure text (e.g. "[protected]") which
        // then fails the jquery non-empty text test
        content += '<div>' + note.content + '</div>';
    }
    else if (note.type === 'code') {
        content += $("<pre>")
            .text(note.content)
            .prop('outerHTML');
    }
    else if (note.type === 'image') {
        content += $("<img>")
            .prop("src", `api/images/${note.noteId}/${note.title}`)
            .prop('outerHTML');
    }
    // other types of notes don't have tooltip preview

    if (!$(content).text().trim() && note.type !== 'image') {
        return "";
    }

    return content;
}

export default {
    setupGlobalTooltip,
    setupElementTooltip
}