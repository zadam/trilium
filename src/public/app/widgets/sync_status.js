import BasicWidget from "./basic_widget.js";
import utils from "../services/utils.js";
import syncService from "../services/sync.js";

const TPL = `
<div class="sync-status-wrapper">
    <style>
    .sync-status-wrapper {
        height: 35px;
        box-sizing: border-box;
        border-bottom: 1px solid var(--main-border-color);
    }
    
    .sync-status {
        height: 34px;
        box-sizing: border-box;
    }
    
    .sync-status button {
        margin-right: 5px;
        margin-left: 5px;
        height: 34px;
        border: none;
        font-size: 180%;
        padding-left: 10px;
        padding-right: 10px;
    }
    
    .sync-status button span {
        position: relative;
        top: -5px;
    }
    
    .sync-status button:hover {
        background-color: var(--hover-item-background-color);
    }
    
    .sync-status .dropdown-menu {
        width: 20em;
    }
    </style>

    <div class="sync-status">
        <button type="button" class="btn btn-sm" title="Sync status">
            <span class="bx bx-badge-check"></span>
<!--            <span class="bx bx-cloud-upload"></span>-->
<!--            <span class="bx bx-sync bx-spin bx-flip-horizontal"></span>-->
        </button>
    </div>
</div>
`;

export default class SyncStatusWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
        this.overflowing();
    }
}
