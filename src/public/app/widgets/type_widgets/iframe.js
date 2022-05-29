import TypeWidget from "./type_widget.js";
import attributeService from "../../services/attributes.js";

const TPL = `
<div class="note-detail-iframe note-detail-printable" style="height: 100%">
    <div class="note-detail-iframe-help alert alert-warning" style="margin: 50px; padding: 20px;">
        <p><strong>This help note is shown because this note of type IFrame HTML doesn't have required label to function properly.</strong></p>

        <p>Please create label with a URL address you want to embed, e.g. <code>#iframeSrc="http://www.google.com"</code></p>
    </div>

    <webview class="note-detail-iframe-content"></webview>
</div>`;

export default class IframeTypeWidget extends TypeWidget {
    static getType() { return "iframe"; }

    doRender() {
        this.$widget = $(TPL);
        this.$noteDetailIframeHelp = this.$widget.find('.note-detail-iframe-help');
        this.$noteDetailIframeContent = this.$widget.find('.note-detail-iframe-content');

        window.addEventListener('resize', () => this.setDimensions(), false);

        super.doRender();
    }

    async doRefresh(note) {
        this.$widget.show();
        this.$noteDetailIframeHelp.hide();
        this.$noteDetailIframeContent.hide();

        const iframeSrc = this.note.getLabelValue('iframeSrc');

        if (iframeSrc) {
            this.$noteDetailIframeContent
                .show()
                .attr("src", iframeSrc);
        }
        else {
            this.$noteDetailIframeContent.hide();
            this.$noteDetailIframeHelp.show();
        }

        this.setDimensions();

        setTimeout(() => this.setDimensions(), 1000);
    }

    cleanup() {
        this.$noteDetailIframeContent.removeAttribute("src");
    }

    setDimensions() {
        const $parent = this.$widget;

        this.$noteDetailIframeContent
            .height($parent.height())
            .width($parent.width());
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes().find(attr => attr.name === 'iframeSrc' && attributeService.isAffecting(attr, this.noteContext.note))) {
            this.refresh();
        }
    }
}
