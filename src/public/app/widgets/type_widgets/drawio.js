import TypeWidget from "./type_widget.js";

const TPL = `
<div class="drawio-widget note-detail full-height" style="overflow: hidden">
    <style>
    .note-detail-drawio {
        width: 100%;
        height: 100%;
        border: 0;
    }
    </style>
    <iframe class="note-detail-drawio" src="https://embed.diagrams.net/?embed=1&noExitBtn=1&proto=json&configure=1"></iframe>
</div>`;

export default class DrawioTypeWidget extends TypeWidget {
    constructor() {
        super();

        this.lastApprovedOrigin = "https://embed.diagrams.net"; // allow domain
        this.finishLoad = false; // determine whether the iframe is loaded
    }

    static getType() {
        return "drawio";
    }

    doRender() {
        this.$widget = $(TPL);
        this.$noteDetailDrawio = this.$widget.find('.note-detail-drawio').get(0);
        this.$noteDetailDrawio.onload = () => {
            this.finishLoad = true
        }

        window.addEventListener('message', (e) => this.drawReceive(e));

        super.doRender();
    }

    async doRefresh(note) {
        const blob = await note.getBlob();

        this.content = blob.content

        if (this.finishLoad) {
            this.drawEventInit()
        }
    }

    drawReceive(event) {
        if (!event.data || event.data.length < 1) return;
        if (event.origin !== this.lastApprovedOrigin) return;

        const message = JSON.parse(event.data);

        switch (message.event) {
            case 'init':
                this.drawEventInit()
                break;
            case 'save':
            case 'autosave':
                this.drawEventSave(message.xml)
                break;
            case 'configure':
                this.drawPostMessage({action: 'configure', config: {}});
                break;
            default:
                break;
        }
    }

    // send message
    drawPostMessage (data) {
        this.$noteDetailDrawio.contentWindow.postMessage(JSON.stringify(data), this.lastApprovedOrigin);
    }

    // init
    drawEventInit() {
        this.drawPostMessage({action: 'load', xml: this.content, autosave: 1});
    }

    // save content
    drawEventSave(xml) {
        this.drawContent = xml
        this.saveData()
    }

    async getData() {
        return {
            content: this.drawContent || this.content
        };
    }

    /**
     * save content to backend
     * spacedUpdate is kind of a debouncer.
     */
    saveData() {
        this.spacedUpdate.scheduleUpdate();
    }
}
