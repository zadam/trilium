import BasicWidget from "./basic_widget.js";
import server from "../services/server.js";
import linkService from "../services/link.js";
import dateNotesService from "../services/date_notes.js";
import treeCache from "../services/tree_cache.js";
import utils from "../services/utils.js";
import appContext from "../services/app_context.js";

const TPL = `
<div class="quick-search input-group input-group-sm" style="width: 250px;">
  <style>
    .quick-search {
        margin-left: 10px;
        margin-right: 10px;
    }
  
    .quick-search .dropdown-menu {
        max-height: 600px;
        max-width: 400px;
        overflow-y: auto;
        overflow-x: hidden;
        text-overflow: ellipsis;
        box-shadow: -30px 50px 93px -50px black;
    }
  </style>
  
  <input type="text" class="form-control form-control-sm search-string" placeholder="Quick search">
  <div class="input-group-append">
    <button class="btn btn-outline-secondary search-button" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
        <span class="bx bx-search"></span>
    </button>
    <div class="dropdown-menu dropdown-menu-right"></div>
  </div>
  </div>
</div>`;

const MAX_DISPLAYED_NOTES = 15;

export default class QuickSearchWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
        this.overflowing();

        this.$searchString = this.$widget.find('.search-string');
        this.$dropdownMenu = this.$widget.find('.dropdown-menu');
        this.$dropdownToggle = this.$widget.find('.search-button');
        this.$dropdownToggle.dropdown();

        this.$widget.find('.input-group-append').on('shown.bs.dropdown', () => this.search());

        utils.bindElShortcut(this.$searchString, 'return', () => {
            this.$dropdownToggle.dropdown('show');

            this.$searchString.focus();
        });

        utils.bindElShortcut(this.$searchString, 'down', () => {
            this.$dropdownMenu.find('.dropdown-item:first').focus();
        });

        return this.$widget;
    }

    async search() {
        const searchString = this.$searchString.val().trim();

        if (!searchString) {
            this.$dropdownToggle.dropdown("hide");
            return;
        }

        this.$dropdownMenu.empty();
        this.$dropdownMenu.append('<span class="dropdown-item disabled"><span class="bx bx-loader bx-spin"></span> Searching ...</span>');

        const resultNoteIds = await server.get('quick-search/' + encodeURIComponent(searchString));

        const displayedNoteIds = resultNoteIds.slice(0, Math.min(MAX_DISPLAYED_NOTES, resultNoteIds.length));

        this.$dropdownMenu.empty();

        if (displayedNoteIds.length === 0) {
            this.$dropdownMenu.append('<span class="dropdown-item disabled">No results found</span>');
        }

        for (const note of await treeCache.getNotes(displayedNoteIds)) {
            const $link = await linkService.createNoteLink(note.noteId, {showNotePath: true});
            $link.addClass('dropdown-item');
            $link.attr("tabIndex", "0");
            $link.on('click', () => this.$dropdownToggle.dropdown("hide"));
            utils.bindElShortcut($link, 'return', () => {
                $link.find('a').trigger({
                    type: 'click',
                    which: 1 // left click
                });
            });

            this.$dropdownMenu.append($link);
        }

        if (resultNoteIds.length > MAX_DISPLAYED_NOTES) {
            this.$dropdownMenu.append(`<span class="dropdown-item disabled">... and ${resultNoteIds.length - MAX_DISPLAYED_NOTES} more results.</span>`);
        }

        const $showInFullButton = $('<a class="dropdown-item" tabindex="0">')
            .append($('<button class="btn btn-sm">Show in full search</button>'));

        this.$dropdownMenu.append($showInFullButton);

        utils.bindElShortcut($showInFullButton, 'return', async () => {
            const searchNote = await dateNotesService.createSearchNote({searchString: this.$searchString.val()});

            await appContext.tabManager.getActiveTabContext().setNote(searchNote.noteId);
        });

        utils.bindElShortcut(this.$dropdownMenu.find('.dropdown-item:first'), 'up', () => this.$searchString.focus());

        this.$dropdownToggle.dropdown('update');
    }

    quickSearchEvent() {
        this.$searchString.focus();
    }
}
