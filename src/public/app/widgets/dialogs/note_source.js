import appContext from "../../services/app_context.js";
import BasicWidget from "../basic_widget.js";
import utils from "../../services/utils.js";

const TPL = `
<div class="note-source-dialog modal fade mx-auto" tabindex="-1" role="dialog">
    <style>
        .note-source-dialog .note-source {
            height: 98%;
            width: 100%;
            min-height: 500px;
            overflow: scroll;
            line-height: 0.7;
        }
    </style>

    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Note source</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <textarea readonly="readonly" class="note-source"></textarea>
            </div>
        </div>
    </div>
</div>`;

export default class NoteSourceDialog extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$noteSource = this.$widget.find(".note-source");
    }

    async refresh() {
        const noteCompletement = await appContext.tabManager.getActiveContext().getNoteComplement();

        this.$noteSource.text(this.formatHtml(noteCompletement.content));
    }

    formatHtml(str) {
        const div = document.createElement('div');
        div.innerHTML = str.trim();

        return this.formatNode(div, 0).innerHTML.trim();
    }

    formatNode(node, level) {
        const indentBefore = new Array(level++ + 1).join('  ');
        const indentAfter  = new Array(level - 1).join('  ');
        let textNode;

        for (let i = 0; i < node.children.length; i++) {
            textNode = document.createTextNode('\n' + indentBefore);
            node.insertBefore(textNode, node.children[i]);

            this.formatNode(node.children[i], level);

            if (node.lastElementChild === node.children[i]) {
                textNode = document.createTextNode('\n' + indentAfter);
                node.appendChild(textNode);
            }
        }

        return node;
    }

    async openNoteSourceDialogEvent() {
        await this.refresh();

        utils.openDialog(this.$widget);
    }
}
