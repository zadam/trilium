import BasicWidget from "./basic_widget.js";
import server from "../services/server.js";
import linkService from "../services/link.js";
import treeCache from "../services/tree_cache.js";
import utils from "../services/utils.js";

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
        box-shadow: 10px 10px 93px -25px black;
    }
  </style>
  
  <input type="text" class="form-control form-control-sm search-string" placeholder="Quick search">
  <div class="input-group-append">
    <button class="btn btn-outline-secondary search-button" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
        <span class="bx bx-search"></span>
    </button>
    <div class="dropdown-menu dropdown-menu-right">
      <a class="dropdown-item" href="#">Action</a>
      <a class="dropdown-item" href="#">Another action</a>
      <a class="dropdown-item" href="#">Something else here</a>
      <div role="separator" class="dropdown-divider"></div>
      <a class="dropdown-item" href="#">Separated link</a>
    </div>
  </div>
  </div>
</div>`;

const MAX_DISPLAYED_NOTES = 20;

export default class QuickSearchWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
        this.overflowing();

        this.$searchString = this.$widget.find('.search-string');
        this.$dropdownMenu = this.$widget.find('.dropdown-menu');
        this.$dropdownToggle = this.$widget.find('.search-button');

        this.$widget.find('.input-group-append').on('show.bs.dropdown', () => this.search());

        utils.bindElShortcut(this.$searchString, 'return', () => {
            this.$dropdownToggle.dropdown('show');

            this.$searchString.focus();
        });

        return this.$widget;
    }

    async search() {
        this.$dropdownMenu.empty();
        this.$dropdownMenu.append('<span class="dropdown-item disabled"><span class="bx bx-loader bx-spin"></span> Searching ...</span>');

        const resultNoteIds = await server.get('quick-search/' + encodeURIComponent(this.$searchString.val()));

        const displayedNoteIds = resultNoteIds.slice(0, Math.min(MAX_DISPLAYED_NOTES, resultNoteIds.length));

        this.$dropdownMenu.empty();

        this.$dropdownMenu.append('<div class="dropdown-item"><button class="btn btn-sm">Show in full search</button></div>');

        if (displayedNoteIds.length === 0) {
            this.$dropdownMenu.append('<span class="dropdown-item disabled">No results found</span>');
        }

        for (const note of await treeCache.getNotes(displayedNoteIds)) {
            const $link = await linkService.createNoteLink(note.noteId, {showNotePath: true});
            $link.addClass('dropdown-item');

            this.$dropdownMenu.append($link);
        }

        if (resultNoteIds.length > MAX_DISPLAYED_NOTES) {
            this.$dropdownMenu.append(`<span class="dropdown-item disabled">... and ${resultNoteIds.length - MAX_DISPLAYED_NOTES} more results.</span>`);
        }

        this.$dropdownToggle.dropdown('update');
    }
}
