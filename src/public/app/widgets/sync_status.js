import BasicWidget from "./basic_widget.js";

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
        height: 34px;
        border: none;
        font-size: 180%;
        padding-left: 10px;
        padding-right: 10px;
    }
    
    .sync-status button > span {
        display: inline-block; 
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
            <span class="sync-status-icon sync-status-online-with-changes" title="Connected to the sync server. There are some outstanding changes yet to be synced.">
                <span class="bx bx-wifi"></span>
                <span class="bx bxs-star" style="font-size: 40%; position: absolute; left: -3px; top: 20px;"></span>
            </span>
            <span class="sync-status-icon sync-status-online-no-changes" title="Connected to the sync server. All changes have been already synced.">
                <span class="bx bx-wifi"></span>
            </span>
            <span class="sync-status-icon sync-status-offline-with-changes" title="Establishing the connection to the sync server was unsuccessful. There are some outstanding changes yet to be synced.">
                <span class="bx bx-wifi-off"></span>
                <span class="bx bxs-star" style="font-size: 40%; position: absolute; left: -3px; top: 20px;"></span>
            </span>
            <span class="sync-status-icon sync-status-offline-no-changes" title="Establishing the connection to the sync server was unsuccessful. All known changes have been synced.">
                <span class="bx bx-wifi-off"></span>
            </span>
            <span class="sync-status-icon sync-status-in-progress" title="Sync with the server is in progress.">
                <span class="bx bx-analyse bx-spin"></span>
            </span>
        </button>
    </div>
</div>
`;

export default class SyncStatusWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$widget.hide();

        this.overflowing();
    }

    syncInProgressEvent() {
        this.showIcon('in-progress');
    }

    syncFinishedEvent() {
        this.showIcon('online-no-changes');
    }

    syncFailedEvent() {
        this.showIcon('offline-no-changes');
    }

    showIcon(className) {
        this.$widget.show();
        this.$widget.find('.sync-status-icon').hide();
        this.$widget.find('.sync-status-' + className).show();
    }
}
