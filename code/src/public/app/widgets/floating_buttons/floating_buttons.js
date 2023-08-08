import NoteContextAwareWidget from "../note_context_aware_widget.js";

const TPL = `
<div class="floating-buttons no-print">
    <style>
        .floating-buttons {
            position: relative;
        }
        
        .floating-buttons-children {
            position: absolute; 
            top: 10px; 
            right: 10px;
            display: flex;
            flex-direction: row;
            z-index: 100;
        }
        
        .floating-buttons-children > *:not(.hidden-int):not(.no-content-hidden) {
            margin-left: 10px;
        }
        
        .floating-buttons-children > button, .floating-buttons-children .floating-button {
            font-size: 150%;
            padding: 5px 10px 4px 10px;
            width: 40px;
            cursor: pointer;
            color: var(--button-text-color);
            background: var(--button-background-color);
            border-radius: var(--button-border-radius);
            border: 1px solid transparent;
            display: flex;
            justify-content: space-around;
        }
        
        .floating-buttons-children > button:hover, .floating-buttons-children .floating-button:hover {
            text-decoration: none;
            border-color: var(--button-border-color);
        }
        
        .floating-buttons.temporarily-hidden {
            display: none;
        }
    </style>
    
    <div class="floating-buttons-children"></div>
</div>`;

export default class FloatingButtons extends NoteContextAwareWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$children = this.$widget.find(".floating-buttons-children");

        for (const widget of this.children) {
            this.$children.append(widget.render());
        }
    }

    async refreshWithNote(note) {
        this.toggle(true);
    }

    toggle(show) {
        this.$widget.toggleClass("temporarily-hidden", !show);
    }

    hideFloatingButtonsCommand() {
        this.toggle(false);
    }
}
