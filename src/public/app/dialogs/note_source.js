import appContext from "../services/app_context.js";
import utils from "../services/utils.js";

const $dialog = $("#note-source-dialog");
const $noteSource = $("#note-source");

export async function showDialog() {
    utils.openDialog($dialog);

    const noteCompletement = await appContext.tabManager.getActiveTabContext().getNoteComplement();

    $noteSource.text(formatHtml(noteCompletement.content));
}

function formatHtml(str) {
    const div = document.createElement('div');
    div.innerHTML = str.trim();

    return formatNode(div, 0).innerHTML.trim();
}

function formatNode(node, level) {
    const indentBefore = new Array(level++ + 1).join('  ');
    const indentAfter  = new Array(level - 1).join('  ');
    let textNode;

    for (let i = 0; i < node.children.length; i++) {
        textNode = document.createTextNode('\n' + indentBefore);
        node.insertBefore(textNode, node.children[i]);

        formatNode(node.children[i], level);

        if (node.lastElementChild === node.children[i]) {
            textNode = document.createTextNode('\n' + indentAfter);
            node.appendChild(textNode);
        }
    }

    return node;
}