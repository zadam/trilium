import TabAwareWidget from "./tab_aware_widget.js";
import server from "../services/server.js";
import attributeService from "../services/attributes.js";

const TPL = `
<div class="note-icon-container dropdown">
    <style>
    .note-icon-container {
        padding-top: 3px;
        padding-left: 7px;
        margin-right: 0;
    }
    
    .note-icon-container button {
        font-size: 180%;
        background: transparent;
        border: 1px solid transparent;
        cursor: pointer;
    }
    
    .note-icon-container button:hover {
        border: 1px solid var(--main-border-color);
    }
    
    .note-icon-container .dropdown-menu {
        border-radius: 10px;
        border-width: 2px;
        box-shadow: 10px 10px 93px -25px black;
        padding: 10px 15px 10px 15px !important;
    }
    
    .note-icon-container .filter-row {
        padding-top: 10px;
        padding-bottom: 10px;
        padding-right: 20px;
        display: flex; 
        align-items: baseline;
    }
    
    .note-icon-container .filter-row span {
        display: block;
        padding-left: 15px;
        padding-right: 15px;
        font-weight: bold;
    }
    
    .note-icon-container .icon-list {
        height: 500px;
        overflow: auto;
        font-size: 180%;
    }
    
    .note-icon-container .icon-list span {
        display: inline-block;
        padding: 10px;
        cursor: pointer;
        border: 1px solid transparent;
    }
    
    .note-icon-container .icon-list span:hover {
        border: 1px solid var(--main-border-color);
    }
    </style>
    
    <button class="btn dropdown-toggle" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" title="Change note icon"></button>
    <div class="dropdown-menu" aria-labelledby="note-path-list-button" style="width: 610px;">
        <div class="filter-row">
            <span>Category:</span> <select name="icon-category" class="form-control"></select>
            
            <span>Search:</span> <input type="text" name="icon-search" class="form-control" />
        </div>
        
        <div class="icon-list"></div>
    </div>
</div>`;

let icons = [];
let categories = [];

export default class NoteIconWidget extends TabAwareWidget {
    doRender() {
        this.$widget = $(TPL);
        this.overflowing();
        this.$icon = this.$widget.find('button');
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
        this.$icon.removeClass().addClass(note.getIcon());
    }

    async entitiesReloadedEvent({loadResults}) {
        for (const attr of loadResults.getAttributes()) {
            if (attr.type === 'label'
                && ['iconClass', 'workspaceIconClass'].includes(attr.name)
                && attr.isAffecting(this.note)) {

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

        const {icons} = (await import('./icon_list.js')).default;

        for (const icon of icons) {
            if (categoryId && icon.category_id !== categoryId) {
                continue;
            }

            if (search && search.trim() && !icon.name.includes(search.trim().toLowerCase())) {
                continue;
            }

            this.$iconList.append(
                $('<span>')
                    .addClass(this.getIconClass(icon))
                    .attr("title", icon.name)
            );
        }
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
