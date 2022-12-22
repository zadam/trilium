import NoteContextAwareWidget from "../../note_context_aware_widget.js";
import server from "../../../services/server.js";

const TPL = `<div style="height: 100%; display: flex; flex-direction: column;">
    <style>
        .backend-log-textarea {
            flex-grow: 1; 
            width: 100%;
            border: none;
        }   
    </style>

    <textarea class="backend-log-textarea" readonly="readonly"></textarea>
    
    <div style="display: flex; justify-content: space-around; margin-top: 10px;">
        <button class="refresh-backend-log-button btn btn-primary">Refresh</button>
    </div>
</div>`;

export default class BackendLogWidget extends NoteContextAwareWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$backendLogTextArea = this.$widget.find(".backend-log-textarea");
        this.$refreshBackendLog = this.$widget.find(".refresh-backend-log-button");

        this.$refreshBackendLog.on('click', () => this.load());
    }

    scrollToBottom() {
        this.$backendLogTextArea.scrollTop(this.$backendLogTextArea[0].scrollHeight);
    }

    async refresh() {
        await this.load();
    }

    async load() {
        const backendLog = await server.get('backend-log');

        this.$backendLogTextArea.text(backendLog);

        this.scrollToBottom();
    }
}
