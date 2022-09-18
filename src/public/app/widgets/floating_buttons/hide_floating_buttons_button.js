import NoteContextAwareWidget from "../note_context_aware_widget.js";

const TPL = `
<div class="close-floating-buttons">
    <style>
        .close-floating-buttons {
            display: none;
            margin-left: 5px !important;
        }
    
        /* conditionally display close button if there's some other button visible */
        .floating-buttons *:not(.hidden-int):not(.hidden-no-content) ~ .close-floating-buttons {
            display: block;
        }
        
        .close-floating-buttons-button {
            border: 1px solid transparent;
            color: var(--button-text-color);
            padding: 6px;
            border-radius: 100px;
        }
        
        .close-floating-buttons-button:hover {
            border: 1px solid var(--button-border-color);
        }
    </style>

    <button type="button"
            class="close-floating-buttons-button btn bx bx-x no-print"
            title="Hide buttons"></button>
</div>
`;

export default class HideFloatingButtonsButton extends NoteContextAwareWidget {
    doRender() {
        super.doRender();

        this.$widget = $(TPL);
        this.$widget.on('click', () => this.triggerCommand('hideFloatingButtons'));
        this.contentSized();
    }
}
