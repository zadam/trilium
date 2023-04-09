import NoteContextAwareWidget from "./note_context_aware_widget.js";
import options from "../services/options.js";
import attributeService from "../services/attributes.js";

const TPL = `
<div class="shared-info-widget alert alert-warning">
    <style>
        .shared-info-widget {
            margin: 10px;
            contain: none;
            padding: 10px;
            font-weight: bold;
        }
    </style>
    
    <span class="shared-text"></span> <a class="shared-link external"></a>. For help visit <a href="https://github.com/zadam/trilium/wiki/Sharing">wiki</a>.
</div>`;

export default class SharedInfoWidget extends NoteContextAwareWidget {
    isEnabled() {
        return super.isEnabled() && this.noteId !== '_share' && this.note.hasAncestor('_share');
    }

    doRender() {
        this.$widget = $(TPL);
        this.$sharedLink = this.$widget.find(".shared-link");
        this.$sharedText = this.$widget.find(".shared-text");
        this.contentSized();
    }

    async refreshWithNote(note) {
        const syncServerHost = options.get("syncServerHost");
        let link;

        const shareId = this.getShareId(note);

        if (syncServerHost) {
            link = `${syncServerHost}/share/${shareId}`;
            this.$sharedText.text("This note is shared publicly on");
        }
        else {
            let host = location.host;
            if (host.endsWith('/')) {
                // seems like IE has trailing slash
                // https://github.com/zadam/trilium/issues/3782
                host = host.substr(0, host.length - 1);
            }

            link = `${location.protocol}//${host}${location.pathname}share/${shareId}`;
            this.$sharedText.text("This note is shared locally on");
        }

        this.$sharedLink.attr("href", link).text(link);
    }

    getShareId(note) {
        if (note.hasOwnedLabel('shareRoot')) {
            return '';
        }

        return note.getOwnedLabelValue('shareAlias') || note.noteId;
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes().find(attr => attr.name.startsWith('_share') && attributeService.isAffecting(attr, this.note))) {
            this.refresh();
        }
        else if (loadResults.getBranches().find(branch => branch.noteId === this.noteId)) {
            this.refresh();
        }
    }
}
