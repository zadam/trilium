import NoteContextAwareWidget from "../note_context_aware_widget.js";
import NoteTypeWidget from "../note_type.js";
import ProtectedNoteSwitchWidget from "../protected_note_switch.js";
import EditabilitySelectWidget from "../editability_select.js";
import BookmarkSwitchWidget from "../bookmark_switch.js";
import SharedSwitchWidget from "../shared_switch.js";

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
    
    <div class="bookmark-switch-container"></div>
    
    <div class="shared-switch-container"></div>
</div>`;

export default class BasicPropertiesWidget extends NoteContextAwareWidget {
    constructor() {
        super();

        this.noteTypeWidget = new NoteTypeWidget().contentSized();
        this.protectedNoteSwitchWidget = new ProtectedNoteSwitchWidget().contentSized();
        this.editabilitySelectWidget = new EditabilitySelectWidget().contentSized();
        this.bookmarkSwitchWidget = new BookmarkSwitchWidget().contentSized();
        this.sharedSwitchWidget = new SharedSwitchWidget().contentSized();

        this.child(
            this.noteTypeWidget,
            this.protectedNoteSwitchWidget,
            this.editabilitySelectWidget,
            this.bookmarkSwitchWidget,
            this.sharedSwitchWidget
        );
    }

    get name() {
        return "basicProperties";
    }

    get toggleCommand() {
        return "toggleRibbonBasicProperties";
    }

    getTitle() {
        return {
            show: !this.note.isLaunchBarConfig(),
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
        this.$widget.find(".bookmark-switch-container").append(this.bookmarkSwitchWidget.render());
        this.$widget.find(".shared-switch-container").append(this.sharedSwitchWidget.render());
    }

    async refreshWithNote(note) {
        await super.refreshWithNote(note);

        this.$widget.find(".editability-select-container").toggle(this.note && ['text', 'code'].includes(this.note.type))
    }
}
