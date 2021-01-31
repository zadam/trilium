import TabAwareWidget from "../tab_aware_widget.js";

const TPL = `
<div class="note-properties-widget">
    <style>
        .note-properties-widget {
            padding: 12px;
            color: var(--muted-text-color);
        }
    </style>

    This note was originally taken from: <a class="page-url external"></a>
</div>`;

export default class NotePropertiesWidget extends TabAwareWidget {
    static getType() { return "note-properties"; }

    isEnabled() {
        return this.note && !!this.note.getLabelValue('pageUrl');
    }

    renderTitle(note) {
        return {
            show: this.isEnabled(),
            activate: true,
            $title: 'Info'
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();

        this.$pageUrl = this.$widget.find('.page-url');
    }

    async refreshWithNote(note) {
        const pageUrl = note.getLabelValue('pageUrl');

        this.$pageUrl
            .attr('href', pageUrl)
            .text(pageUrl);
    }
}
