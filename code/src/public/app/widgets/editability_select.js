import attributeService from '../services/attributes.js';
import NoteContextAwareWidget from "./note_context_aware_widget.js";

const TPL = `
<div class="dropdown editability-select-widget">
    <style>
    .editability-dropdown {
        width: 300px;
    }
    
    .editability-dropdown .dropdown-item div {
        font-size: small;
        color: var(--muted-text-color);
        white-space: normal;
    }
    </style>
    <button type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" class="btn btn-sm dropdown-toggle editability-button">
        <span class="editability-active-desc">auto</span>
        <span class="caret"></span>
    </button>
    <div class="editability-dropdown dropdown-menu dropdown-menu-right">
        <a class="dropdown-item" href="#" data-editability="auto">
            <span class="check">&check;</span>
            Auto
            <div>Note is editable if it's not too long.</div>    
        </a>
        <a class="dropdown-item" href="#" data-editability="readOnly">
            <span class="check">&check;</span>
            Read-only
            <div>Note is read-only, but can be edited with a button click.</div>
        </a>
        <a class="dropdown-item" href="#" data-editability="autoReadOnlyDisabled">
            <span class="check">&check;</span>
            Always editable
            <div>Note is always editable, regardless of its length.</div>
        </a>
    </div>
</div>
`;

export default class EditabilitySelectWidget extends NoteContextAwareWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$editabilityActiveDesc = this.$widget.find(".editability-active-desc");

        this.$widget.on('click', '.dropdown-item',
            async e => {
            this.$widget.find('.dropdown-toggle').dropdown('toggle');

            const editability = $(e.target).closest("[data-editability]").attr("data-editability");

            for (const ownedAttr of this.note.getOwnedLabels()) {
                if (['readOnly', 'autoReadOnlyDisabled'].includes(ownedAttr.name)) {
                    await attributeService.removeAttributeById(this.noteId, ownedAttr.attributeId);
                }
            }

            if (editability !== 'auto') {
                await attributeService.addLabel(this.noteId, editability);
            }
        });
    }

    async refreshWithNote(note) {
        let editability = 'auto'

        if (this.note.isLabelTruthy('readOnly')) {
            editability = 'readOnly';
        }
        else if (this.note.isLabelTruthy('autoReadOnlyDisabled')) {
            editability = 'autoReadOnlyDisabled';
        }

        const labels = {
            "auto": "Auto",
            "readOnly": "Read-only",
            "autoReadOnlyDisabled": "Always Editable"
        }

        this.$widget.find('.dropdown-item').removeClass("selected");
        this.$widget.find(`.dropdown-item[data-editability='${editability}']`).addClass("selected");

        this.$editabilityActiveDesc.text(labels[editability]);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributeRows().find(attr => attr.noteId === this.noteId)) {
            this.refresh();
        }
    }
}
