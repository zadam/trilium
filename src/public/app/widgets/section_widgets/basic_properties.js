import NoteContextAwareWidget from "../note_context_aware_widget.js";
import NoteTypeWidget from "../note_type.js";
import ProtectedNoteSwitchWidget from "../protected_note_switch.js";

const TPL = `
<div class="basic-properties-widget">
    <style>
        .basic-properties-widget {
            padding: 12px 12px 6px 12px;
            display: flex;
            align-items: baseline;
        }
        
        .note-type-container {
            display: flex;
            align-items: center;
        }
        
        .basic-properties-widget > * {
            margin-right: 30px;
        }
    </style>
    
    <div class="note-type-container" style="display: flex">
        <span>Note type:</span> &nbsp;
    </div>
    
    <div class="protected-note-switch-container"></div>
</div>`;

export default class BasicPropertiesWidget extends NoteContextAwareWidget {
    constructor() {
        super();

        this.noteTypeWidget = new NoteTypeWidget();
        this.protectedNoteSwitchWidget = new ProtectedNoteSwitchWidget();

        this.child(this.noteTypeWidget, this.protectedNoteSwitchWidget);
    }

    static getType() { return "basic-properties"; }

    isEnabled() {
        return this.note;
    }

    getTitle() {
        return {
            show: this.isEnabled(),
            title: 'Basic Properties',
            icon: 'bx bx-slider'
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.overflowing();

        this.$widget.find(".note-type-container").append(this.noteTypeWidget.render());
        this.$widget.find(".protected-note-switch-container").append(this.protectedNoteSwitchWidget.render());
    }
}
