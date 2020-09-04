import ws from "./ws.js";
import linkService from "./link.js";

function renderAttribute(attribute, $container, renderIsInheritable) {
    const isInheritable = renderIsInheritable && attribute.isInheritable ? `(inheritable)` : '';

    if (attribute.type === 'label') {
        $container.append(document.createTextNode('#' + attribute.name + isInheritable));

        if (attribute.value) {
            $container.append('=');
            $container.append(document.createTextNode(formatValue(attribute.value)));
        }
    } else if (attribute.type === 'relation') {
        if (attribute.isAutoLink) {
            return;
        }

        // when the relation has just been created then it might not have a value
        if (attribute.value) {
            $container.append(document.createTextNode('~' + attribute.name + isInheritable + "="));
            $container.append(createNoteLink(attribute.value));
        }
    } else {
        ws.logError("Unknown attr type: " + attribute.type);
    }
}

function formatValue(val) {
    if (/^[\p{L}\p{N}\-_,.]+$/u.test(val)) {
        return val;
    }
    else if (!val.includes('"')) {
        return '"' + val + '"';
    }
    else if (!val.includes("'")) {
        return "'" + val + "'";
    }
    else if (!val.includes("`")) {
        return "`" + val + "`";
    }
    else {
        return '"' + val.replace(/"/g, '\\"') + '"';
    }
}

function createNoteLink(noteId) {
    const $link = $("<a>", {
        href: '#' + noteId,
        class: 'reference-link',
        'data-note-path': noteId
    });

    linkService.loadReferenceLinkTitle(noteId, $link);

    return $link;
}

export default {
    renderAttribute
}
