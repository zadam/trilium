import NoteContextAwareWidget from "./note_context_aware_widget.js";
import attributeService from "../services/attributes.js";

const TPL = `
<div class="note-icon-widget dropdown">
    <style>
    .note-icon-widget {
        padding-top: 3px;
        padding-left: 7px;
        margin-right: 0;
        width: 50px;
        height: 50px;
    }
    
    .note-icon-widget button.note-icon {
        font-size: 180%;
        background-color: transparent;
        border: 1px solid transparent;
        cursor: pointer;
        padding: 6px;
        color: var(--main-text-color);
    }
    
    .note-icon-widget button.note-icon:hover {
        border: 1px solid var(--main-border-color);
    }
    
    .note-icon-widget .dropdown-menu {
        border-radius: 10px;
        border-width: 2px;
        box-shadow: 10px 10px 93px -25px black;
        padding: 10px 15px 10px 15px !important;
    }
    
    .note-icon-widget .filter-row {
        padding-top: 10px;
        padding-bottom: 10px;
        padding-right: 20px;
        display: flex; 
        align-items: baseline;
    }
    
    .note-icon-widget .filter-row span {
        display: block;
        padding-left: 15px;
        padding-right: 15px;
        font-weight: bold;
    }
    
    .note-icon-widget .icon-list {
        height: 500px;
        overflow: auto;
    }
    
    .note-icon-widget .icon-list span {
        display: inline-block;
        padding: 10px;
        cursor: pointer;
        border: 1px solid transparent;
        font-size: 180%;
    }
    
    .note-icon-widget .icon-list span:hover {
        border: 1px solid var(--main-border-color);
    }
    </style>
    
    <button class="btn dropdown-toggle note-icon" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" title="Change note icon"></button>
    <div class="dropdown-menu" aria-labelledby="note-path-list-button" style="width: 610px;">
        <div class="filter-row">
            <span>Category:</span> <select name="icon-category" class="form-control"></select>
            
            <span>Search:</span> <input type="text" name="icon-search" class="form-control" />
        </div>
        
        <div class="icon-list"></div>
    </div>
</div>`;

export default class NoteIconWidget extends NoteContextAwareWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$icon = this.$widget.find('button.note-icon');
        this.$iconList = this.$widget.find('.icon-list');
        this.$iconList.on('click', 'span', async e => {
            const clazz = $(e.target).attr('class');

            await attributeService.setLabel(this.noteId,
                this.note.hasOwnedLabel('workspace') ? 'workspaceIconClass' : 'iconClass',
                clazz
            );
        });

        this.$iconCategory = this.$widget.find("select[name='icon-category']");
        this.$iconCategory.on('change', () => this.renderFilteredDropdown());
        this.$iconCategory.on('click', e => e.stopPropagation());

        this.$iconSearch = this.$widget.find("input[name='icon-search']");
        this.$iconSearch.on('input', () => this.renderFilteredDropdown());

        this.$notePathList = this.$widget.find(".note-path-list");
        this.$widget.on('show.bs.dropdown', async () => {
            const {categories} = (await import('./icon_list.js')).default;

            this.$iconCategory.empty();

            for (const category of categories) {
                this.$iconCategory.append(
                    $("<option>")
                        .text(category.name)
                        .attr("value", category.id)
                );
            }

            this.$iconSearch.val('');

            this.renderDropdown();
        });
    }

    async refreshWithNote(note) {
        this.$icon.removeClass().addClass(note.getIcon() + " note-icon");
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            this.refresh();
            return;
        }

        for (const attr of loadResults.getAttributes()) {
            if (attr.type === 'label'
                && ['iconClass', 'workspaceIconClass'].includes(attr.name)
                && attributeService.isAffecting(attr, this.note)) {

                this.refresh();
                break;
            }
        }
    }

    renderFilteredDropdown() {
        const categoryId = parseInt(this.$iconCategory.find('option:selected').val());
        const search = this.$iconSearch.val();

        this.renderDropdown(categoryId, search);
    }

    async renderDropdown(categoryId, search) {
        this.$iconList.empty();

        if (this.getIconLabels().length > 0) {
            this.$iconList.append(
                $(`<div style="text-align: center">`)
                    .append(
                        $('<button class="btn btn-sm">Reset to default icon</button>')
                            .on('click', () => this.getIconLabels()
                                .forEach(label => attributeService.removeAttributeById(this.noteId, label.attributeId))
                            )
                    )
            );
        }

        const {icons} = (await import('./icon_list.js')).default;

        search = search?.trim()?.toLowerCase();

        for (const icon of icons) {
            if (categoryId && icon.category_id !== categoryId) {
                continue;
            }

            if (search) {
                if (!icon.name.includes(search) && !icon.term?.find(t => t.includes(search))) {
                    continue;
                }
            }

            this.$iconList.append(
                $('<span>')
                    .addClass(this.getIconClass(icon))
                    .attr("title", icon.name)
            );
        }

        this.$iconSearch.focus();
    }

    getIconLabels() {
        return this.note.getOwnedLabels()
            .filter(label => ['workspaceIconClass', 'iconClass'].includes(label.name));
    }

    getIconClass(icon) {
        if (icon.type_of_icon === 'LOGO') {
            return "bx bxl-" + icon.name;
        }
        else if (icon.type_of_icon === 'SOLID') {
            return "bx bxs-" + icon.name;
        }
        else {
            return "bx bx-" + icon.name;
        }
    }
}
