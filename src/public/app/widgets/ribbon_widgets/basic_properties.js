import NoteContextAwareWidget from "../note_context_aware_widget.js";
import NoteTypeWidget from "../note_type.js";
import ProtectedNoteSwitchWidget from "../protected_note_switch.js";
import EditabilitySelectWidget from "../editability_select.js";

const TPL = `
<div class="basic-properties-widget">
    <style>
        .basic-properties-widget {
            padding: 0px 12px 6px 12px;
            display: flex;
            align-items: baseline;
            flex-wrap: wrap;
        }
        
        .basic-properties-widget > * {
            margin-right: 30px;
            margin-top: 12px;
        }
        
        .note-type-container, .editability-select-container {
            display: flex;
            align-items: center;
        }
    </style>
    
    <div class="note-type-container">
        <span>Note type:</span> &nbsp;
    </div>
    
    <div class="protected-note-switch-container"></div>
    
    <div class="editability-select-container">
        <span>Editable:</span> &nbsp;
    </div>
</div>`;

export default class BasicPropertiesWidget extends NoteContextAwareWidget {
    constructor() {
        super();

        this.noteTypeWidget = new NoteTypeWidget().contentSized();
        this.protectedNoteSwitchWidget = new ProtectedNoteSwitchWidget().contentSized();
        this.editabilitySelectWidget = new EditabilitySelectWidget().contentSized();

        this.child(this.noteTypeWidget, this.protectedNoteSwitchWidget, this.editabilitySelectWidget);
    }

    get name() {
        return "basicProperties";
    }

    isEnabled() {
        return this.note && (this.note.type === 'text' || this.note.type === 'code');
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
        this.contentSized();

        this.$widget.find(".note-type-container").append(this.noteTypeWidget.render());
        this.$widget.find(".protected-note-switch-container").append(this.protectedNoteSwitchWidget.render());
        this.$widget.find(".editability-select-container").append(this.editabilitySelectWidget.render());
    }
}
