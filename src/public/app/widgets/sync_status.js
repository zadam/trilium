import BasicWidget from "./basic_widget.js";
import toastService from "../services/toast.js";
import ws from "../services/ws.js";
import options from "../services/options.js";
import syncService from "../services/sync.js";

const TPL = `
<div class="sync-status-widget">
    <style>
    .sync-status-widget {
        height: 35px;
        box-sizing: border-box;
        border-bottom: 1px solid var(--main-border-color);
    }
    
    .sync-status {
        height: 34px;
        box-sizing: border-box;
    }
    
    .sync-status .sync-status-icon {
        height: 34px;
        font-size: 180%;
        display: inline-block;
        position: relative;
        padding-left: 10px;
        padding-right: 10px;
    }
    
    .sync-status .sync-status-sub-icon {
        font-size: 40%; 
        position: absolute; 
        left: 7px; 
        top: 20px;
    }
    
    .sync-status .sync-status-icon span {
        border: none !important;
    }
    
    .sync-status-icon:not(.sync-status-in-progress):hover {
        background-color: var(--hover-item-background-color);
        cursor: pointer;
    }
    </style>

    <div class="sync-status">
        <span class="sync-status-icon sync-status-connected-with-changes" title="<p>Connected to the sync server. <br>There are some outstanding changes yet to be synced.</p><p>Click to trigger sync.</p>">
            <span class="bx bx-wifi"></span>
            <span class="bx bxs-star sync-status-sub-icon"></span>
        </span>
        <span class="sync-status-icon sync-status-connected-no-changes" 
              data-toggle="tooltip" 
              title="<p>Connected to the sync server.<br>All changes have been already synced.</p><p>Click to trigger sync.</p>">
            <span class="bx bx-wifi"></span>
        </span>
        <span class="sync-status-icon sync-status-disconnected-with-changes"
              data-toggle="tooltip" 
              title="<p>Establishing the connection to the sync server was unsuccessful.<br>There are some outstanding changes yet to be synced.</p><p>Click to trigger sync.</p>">
            <span class="bx bx-wifi-off"></span>
            <span class="bx bxs-star sync-status-sub-icon"></span>
        </span>
        <span class="sync-status-icon sync-status-disconnected-no-changes" 
              data-toggle="tooltip"
              title="<p>Establishing the connection to the sync server was unsuccessful.<br>All known changes have been synced.</p><p>Click to trigger sync.</p>">
            <span class="bx bx-wifi-off"></span>
        </span>
        <span class="sync-status-icon sync-status-in-progress" 
              data-toggle="tooltip"
              title="Sync with the server is in progress.">
            <span class="bx bx-analyse bx-spin"></span>
        </span>
    </div>
</div>
`;

export default class SyncStatusWidget extends BasicWidget {
    constructor() {
        super();

        ws.subscribeToMessages(message => this.processMessage(message));

        this.syncState = 'disconnected';
        this.allChangesPushed = false;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$widget.hide();

        this.$widget.find('[data-toggle="tooltip"]').tooltip({
            html: true
        });

        this.$widget.find('.sync-status-icon:not(.sync-status-in-progress)')
            .on('click', () => syncService.syncNow())

        this.overflowing();
    }

    showIcon(className) {
        if (!options.get('syncServerHost')) {
            this.$widget.hide();
            return;
        }

        this.$widget.show();
        this.$widget.find('.sync-status-icon').hide();
        this.$widget.find('.sync-status-' + className).show();
    }

    processMessage(message) {
        if (message.type === 'sync-pull-in-progress') {
            toastService.showPersistent({
                id: 'sync',
                title: "Sync status",
                message: "Sync update in progress",
                icon: "refresh"
            });

            this.syncState = 'in-progress';
            this.allChangesPushed = false;
        }
        else if (message.type === 'sync-push-in-progress') {
            this.syncState = 'in-progress';
            this.allChangesPushed = false;
        }
        else if (message.type === 'sync-finished') {
            // this gives user a chance to see the toast in case of fast sync finish
            setTimeout(() => toastService.closePersistent('sync'), 1000);

            this.syncState = 'connected';
        }
        else if (message.type === 'sync-failed') {
            this.syncState = 'disconnected';
        }
        else if (message.type === 'frontend-update') {
            const {lastSyncedPush} = message.data;

            this.allChangesPushed = lastSyncedPush === ws.getMaxKnownEntityChangeSyncId();
        }

        if (this.syncState === 'in-progress') {
            this.showIcon('in-progress');
        } else {
            this.showIcon(this.syncState + '-' + (this.allChangesPushed ? 'no-changes' : 'with-changes'));
        }
    }
}
