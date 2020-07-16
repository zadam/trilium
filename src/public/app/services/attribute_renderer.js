import ws from "./ws.js";

function renderAttribute(attribute, $container, renderIsInheritable) {
    const isInheritable = renderIsInheritable && attribute.isInheritable ? `(inheritable)` : '';

    if (attribute.type === 'label') {
        $container.append(document.createTextNode('#' + attribute.name + isInheritable));

        if (attribute.value) {
            $container.append('=');
            $container.append(document.createTextNode(formatValue(attribute.value)));
        }

        $container.append(' ');
    } else if (attribute.type === 'relation') {
        if (attribute.isAutoLink) {
            return;
        }

        if (attribute.value) {
            $container.append(document.createTextNode('~' + attribute.name + isInheritable + "="));
            $container.append(createNoteLink(attribute.value));
            $container.append(" ");
        } else {
            ws.logError(`Relation ${attribute.attributeId} has empty target`);
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
    return $("<a>", {
        href: '#' + noteId,
        class: 'reference-link',
        'data-note-path': noteId
    });
}

export default {
    renderAttribute
}
