import NoteContextAwareWidget from "../note_context_aware_widget.js";
import dialogService from "../dialog.js";
import server from "../../services/server.js";
import toastService from "../../services/toast.js";

const TPL = `
<button type="button"
        class="export-mermaid-button floating-button btn bx bx-export no-print"
        title="Export Mermaid diagram as SVG"></button>
`;

export default class MermaidExportButton extends NoteContextAwareWidget {
    isEnabled() {
        return super.isEnabled()
            && this.note?.type === 'mermaid'
            && this.note.isContentAvailable();
    }

    doRender() {
        super.doRender();

        this.$widget = $(TPL);
        this.$widget.on('click', () => this.triggerEvent('exportMermaid', {ntxId: this.ntxId}));
        this.contentSized();
    }
}
