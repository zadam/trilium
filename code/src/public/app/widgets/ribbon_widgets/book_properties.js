import NoteContextAwareWidget from "../note_context_aware_widget.js";
import attributeService from "../../services/attributes.js";

const TPL = `
<div class="book-properties-widget">
    <style>
        .book-properties-widget {
            padding: 12px 12px 6px 12px;
            display: flex;
        }
        
        .book-properties-widget > * {
            margin-right: 15px;
        }
    </style>

    <div style="display: flex; align-items: baseline">
        <span style="white-space: nowrap">View type:&nbsp; &nbsp;</span>
        
        <select class="view-type-select form-control form-control-sm">
            <option value="grid">Grid</option>
            <option value="list">List</option>
        </select>
    </div>
    
    <button type="button"
            class="collapse-all-button btn btn-sm"
            title="Collapse all notes">
    
        <span class="bx bx-layer-minus"></span>
        
        Collapse
    </button>

    <button type="button"
            class="expand-children-button btn btn-sm"
            title="Expand all children">
        <span class="bx bx-move-vertical"></span>
        
        Expand
    </button>
</div>
`;
export default class BookPropertiesWidget extends NoteContextAwareWidget {
    get name() {
        return "bookProperties";
    }

    get toggleCommand() {
        return "toggleRibbonTabBookProperties";
    }

    isEnabled() {
        return this.note && this.note.type === 'book';
    }

    getTitle() {
        return {
            show: this.isEnabled(),
            activate: true,
            title: 'Book Properties',
            icon: 'bx bx-book'
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();

        this.$viewTypeSelect = this.$widget.find('.view-type-select');
        this.$viewTypeSelect.on('change', () => this.toggleViewType(this.$viewTypeSelect.val()));

        this.$expandChildrenButton = this.$widget.find('.expand-children-button');
        this.$expandChildrenButton.on('click', async () => {
            if (!this.note.isLabelTruthy('expanded')) {
                await attributeService.addLabel(this.noteId, 'expanded');
            }

            this.triggerCommand('refreshNoteList', {noteId: this.noteId});
        });

        this.$collapseAllButton = this.$widget.find('.collapse-all-button');
        this.$collapseAllButton.on('click', async () => {
            // owned is important - we shouldn't remove inherited expanded labels
            for (const expandedAttr of this.note.getOwnedLabels('expanded')) {
                await attributeService.removeAttributeById(this.noteId, expandedAttr.attributeId);
            }

            this.triggerCommand('refreshNoteList', {noteId: this.noteId});
        });
    }

    async refreshWithNote(note) {
        const viewType = this.note.getLabelValue('viewType') || 'grid';

        this.$viewTypeSelect.val(viewType);

        this.$expandChildrenButton.toggle(viewType === 'list');
        this.$collapseAllButton.toggle(viewType === 'list');
    }

    async toggleViewType(type) {
        if (type !== 'list' && type !== 'grid') {
            throw new Error(`Invalid view type '${type}'`);
        }

        await attributeService.setLabel(this.noteId, 'viewType', type);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributeRows().find(attr => attr.noteId === this.noteId && attr.name === 'viewType')) {
            this.refresh();
        }
    }
}
