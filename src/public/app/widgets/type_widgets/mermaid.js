import libraryLoader from "../../services/library_loader.js";
import TypeWidget from "./type_widget.js";
import froca from "../../services/froca.js";
import options from "../../services/options.js";

const TPL = `<div>
    <div class="mermaid-error alert alert-warning">
        <p><strong>The diagram could not displayed.</strong></p>
        <p class="error-content"></p>
    </div>

    <div class="mermaid-renderer"></div>
</div>`;

export default class MermaidTypeWidget extends TypeWidget {
    static getType() { return "mermaid"; }

    doRender() {
        this.$widget = $(TPL);
        this.$display = this.$widget.find('.mermaid-renderer');

        this.$errorContainer = this.$widget.find(".mermaid-error");
        this.$errorMessage = this.$errorContainer.find(".error-content");

        this.initialized = this.initRenderer();

        super.doRender();
    }

    async initRenderer() {
        await libraryLoader.requireLibrary(libraryLoader.MERMAID);
        await options.initializedPromise;

        mermaid.mermaidAPI.initialize({ startOnLoad: false, theme: options.get('theme') == 'dark' ? 'dark' : 'default' });

        this.update("");

        this.$widget.show();
    }

    async doRefresh(note) {
        const noteComplement = await froca.getNoteComplement(note.noteId);

        await this.spacedUpdate.allowUpdateWithoutChange(() => {
            this.update(noteComplement.content || "");
        });
    }

    async update(graph) {
        const updateWithContent = (content) => {
            this.$display.html(content);
        }

        this.$display.empty();

        this.$errorContainer.text('Rendering diagram...');

        try {
            mermaid.mermaidAPI.render('graphDiv', graph, updateWithContent);

            this.$errorContainer.hide();
        } catch (e) {
            this.$errorMessage.text(e.message);
            this.$errorContainer.show();
        }
    }
}