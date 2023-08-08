import TypeWidget from "./type_widget.js";
import attributeService from "../../services/attributes.js";

const TPL = `
<div class="note-detail-web-view note-detail-printable" style="height: 100%">
    <div class="note-detail-web-view-help alert alert-warning" style="margin: 50px; padding: 20px 20px 0px 20px;">
        <h4>Web View</h4>
        
        <p>Note of type Web View allow you to embed websites into Trilium.</p>

        <p>To start, please create a label with a URL address you want to embed, e.g. <code>#webViewSrc="http://www.google.com"</code></p>

        <h4>Disclaimer on the experimental status</h4>
        
        <p>Web View is an experimental note type, and it might be removed or substantially changed in the future. Web View works also only in the desktop build.</p>
    </div>

    <webview class="note-detail-web-view-content"></webview>
</div>`;

export default class WebViewTypeWidget extends TypeWidget {
    static getType() { return "webView"; }

    doRender() {
        this.$widget = $(TPL);
        this.$noteDetailWebViewHelp = this.$widget.find('.note-detail-web-view-help');
        this.$noteDetailWebViewContent = this.$widget.find('.note-detail-web-view-content');

        window.addEventListener('resize', () => this.setDimensions(), false);

        super.doRender();
    }

    async doRefresh(note) {
        this.$widget.show();
        this.$noteDetailWebViewHelp.hide();
        this.$noteDetailWebViewContent.hide();

        const webViewSrc = this.note.getLabelValue('webViewSrc');

        if (webViewSrc) {
            this.$noteDetailWebViewContent
                .show()
                .attr("src", webViewSrc);
        }
        else {
            this.$noteDetailWebViewContent.hide();
            this.$noteDetailWebViewHelp.show();
        }

        this.setDimensions();

        setTimeout(() => this.setDimensions(), 1000);
    }

    cleanup() {
        this.$noteDetailWebViewContent.removeAttribute("src");
    }

    setDimensions() {
        const $parent = this.$widget;

        this.$noteDetailWebViewContent
            .height($parent.height())
            .width($parent.width());
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributeRows().find(attr => attr.name === 'webViewSrc' && attributeService.isAffecting(attr, this.noteContext.note))) {
            this.refresh();
        }
    }
}
