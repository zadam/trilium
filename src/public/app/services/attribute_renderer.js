import ws from "./ws.js";
import treeCache from "./tree_cache.js";

async function renderAttribute(attribute, renderIsInheritable) {
    const isInheritable = renderIsInheritable && attribute.isInheritable ? `(inheritable)` : '';
    const $attr = $("<span>");

    if (attribute.type === 'label') {
        $attr.append(document.createTextNode('#' + attribute.name + isInheritable));

        if (attribute.value) {
            $attr.append('=');
            $attr.append(document.createTextNode(formatValue(attribute.value)));
        }
    } else if (attribute.type === 'relation') {
        if (attribute.isAutoLink) {
            return $attr;
        }

        // when the relation has just been created then it might not have a value
        if (attribute.value) {
            $attr.append(document.createTextNode('~' + attribute.name + isInheritable + "="));
            $attr.append(await createNoteLink(attribute.value));
        }
    } else {
        ws.logError("Unknown attr type: " + attribute.type);
    }

    return $attr;
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

async function createNoteLink(noteId) {
    const note = await treeCache.getNote(noteId);

    if (!note) {
        return;
    }

    return $("<a>", {
        href: '#' + noteId,
        class: 'reference-link',
        'data-note-path': noteId
    })
        .text(note.title);
}

async function renderAttributes(attributes, renderIsInheritable) {
    const $container = $("<span>");

    for (let i = 0; i < attributes.length; i++) {
        const attribute = attributes[i];

        const $attr = await renderAttribute(attribute, renderIsInheritable);
        $container.append($attr.html()); // .html() to get only inner HTML, we don't want any spans

        if (i < attributes.length - 1) {
            $container.append(" ");
        }
    }

    return $container;
}

export default {
    renderAttribute,
    renderAttributes
}
