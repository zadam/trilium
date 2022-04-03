import libraryLoader from "../services/library_loader.js";
import NoteContextAwareWidget from "./note_context_aware_widget.js";
import froca from "../services/froca.js";

const TPL = `<div class="mermaid-widget">
    <style>
        .mermaid-widget {
            flex-grow: 2;
            overflow: auto;
            min-height: 200px;
            border-bottom: 1px solid var(--main-border-color);
            padding: 20px;
            margin-bottom: 10px;
            flex-basis: 0;
        }
        
        .mermaid-render {
            overflow: auto;
            height: 100%;
            text-align: center;
        }
    </style>

    <div class="mermaid-error alert alert-warning">
        <p><strong>The diagram could not be displayed. See <a href="https://mermaid-js.github.io/mermaid/#/flowchart?id=graph">help and examples</a>.</strong></p>
        <p class="error-content"></p>
    </div>

    <div class="mermaid-render"></div>
</div>`;

let idCounter = 1;

export default class MermaidWidget extends NoteContextAwareWidget {
    isEnabled() {
        return super.isEnabled() && this.note && this.note.type === 'mermaid';
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$display = this.$widget.find('.mermaid-render');
        this.$errorContainer = this.$widget.find(".mermaid-error");
        this.$errorMessage = this.$errorContainer.find(".error-content");
    }

    async refreshWithNote(note) {
        this.$errorContainer.hide();

        await libraryLoader.requireLibrary(libraryLoader.MERMAID);

        const documentStyle = window.getComputedStyle(document.documentElement);
        const mermaidTheme = documentStyle.getPropertyValue('--mermaid-theme');

        mermaid.mermaidAPI.initialize({
            startOnLoad: false,
            theme: mermaidTheme.trim(),
            securityLevel: 'antiscript',
            flow: { useMaxWidth: false },
            sequence: { useMaxWidth: false },
            gantt: { useMaxWidth: false },
            "class": { useMaxWidth: false },
            state: { useMaxWidth: false },
            pie: { useMaxWidth: false },
            journey: { useMaxWidth: false },
            git: { useMaxWidth: false },
        });

        const noteComplement = await froca.getNoteComplement(note.noteId);
        const content = noteComplement.content || "";

        this.$display.empty();

        const libLoaded = libraryLoader.requireLibrary(libraryLoader.WHEEL_ZOOM);

        try {
            const idNumber = idCounter++;

            mermaid.mermaidAPI.render('mermaid-graph-' + idNumber, content, async content => {
                this.$display.html(content);

                await libLoaded;

                this.$display.attr("id", 'mermaid-render-' + idNumber);

                WZoom.create('#mermaid-render-' + idNumber, {
                    type: 'html',
                    maxScale: 10,
                    speed: 20,
                    zoomOnClick: false
                });
            });

            this.$errorContainer.hide();
        } catch (e) {
            this.$errorMessage.text(e.message);
            this.$errorContainer.show();
        }
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteContentReloaded(this.noteId)) {
            await this.refresh();
        }
    }
}
