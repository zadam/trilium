import server from "../../services/server.js";
import utils from "../../services/utils.js";
import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="backend-log-dialog modal fade mx-auto" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-xl" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Backend log</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <textarea class="backend-log-textarea" readonly="readonly" style="min-height: 600px; width: 100%;"></textarea>
            </div>
            <div class="modal-footer">
                <button class="refresh-backend-log-button btn btn-primary">Refresh</button>
            </div>
        </div>
    </div>
</div>`;

export default class BackendLogDialog extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$backendLogTextArea = this.$widget.find(".backend-log-textarea");
        this.$refreshBackendLog = this.$widget.find(".refresh-backend-log-button");

        this.$refreshBackendLog.on('click', () => this.load());

        this.$widget.on('shown.bs.modal', () => this.scrollToBottom());
    }

    scrollToBottom() {
        this.$backendLogTextArea.scrollTop(this.$backendLogTextArea[0].scrollHeight);
    }

    async load() {
        const backendLog = await server.get('backend-log');

        this.$backendLogTextArea.text(backendLog);

        this.scrollToBottom();
    }

    async showBackendLogEvent() {
        utils.openDialog(this.$widget);

        this.load();
    }
}
