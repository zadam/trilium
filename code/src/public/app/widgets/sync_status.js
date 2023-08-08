import BasicWidget from "./basic_widget.js";
import ws from "../services/ws.js";
import options from "../services/options.js";
import syncService from "../services/sync.js";

const TPL = `
<div class="sync-status-widget launcher-button">
    <style>
    .sync-status-widget {
    }
    
    .sync-status {
        box-sizing: border-box;
    }
    
    .sync-status .sync-status-icon {
        display: inline-block;
        position: relative;
        top: -5px;
        font-size: 110%;
    }
    
    .sync-status .sync-status-sub-icon {
        font-size: 40%; 
        position: absolute; 
        left: 0;
        top: 16px;
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
        <span class="sync-status-icon sync-status-unknown bx bx-time" 
              data-toggle="tooltip" 
              data-placement="right"
              title="<p>Sync status will be known once the next sync attempt starts.</p><p>Click to trigger sync now.</p>">
        </span>
        <span class="sync-status-icon sync-status-connected-with-changes bx bx-wifi"
              data-toggle="tooltip" 
              data-placement="right"
              title="<p>Connected to the sync server. <br>There are some outstanding changes yet to be synced.</p><p>Click to trigger sync.</p>">
            <span class="bx bxs-star sync-status-sub-icon"></span>
        </span>
        <span class="sync-status-icon sync-status-connected-no-changes bx bx-wifi" 
              data-toggle="tooltip" 
              data-placement="right"
              title="<p>Connected to the sync server.<br>All changes have been already synced.</p><p>Click to trigger sync.</p>">
        </span>
        <span class="sync-status-icon sync-status-disconnected-with-changes bx bx-wifi-off"
              data-toggle="tooltip" 
              data-placement="right"
              title="<p>Establishing the connection to the sync server was unsuccessful.<br>There are some outstanding changes yet to be synced.</p><p>Click to trigger sync.</p>">
            <span class="bx bxs-star sync-status-sub-icon"></span>
        </span>
        <span class="sync-status-icon sync-status-disconnected-no-changes bx bx-wifi-off" 
              data-toggle="tooltip"
              data-placement="right"
              title="<p>Establishing the connection to the sync server was unsuccessful.<br>All known changes have been synced.</p><p>Click to trigger sync.</p>">
        </span>
        <span class="sync-status-icon sync-status-in-progress bx bx-analyse bx-spin" 
              data-toggle="tooltip"
              data-placement="right"
              title="Sync with the server is in progress.">
        </span>
    </div>
</div>
`;

export default class SyncStatusWidget extends BasicWidget {
    constructor() {
        super();

        this.syncState = 'unknown';
        this.allChangesPushed = false;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$widget.hide();

        this.$widget.find('[data-toggle="tooltip"]').tooltip({
            html: true
        });

        this.$widget.find('.sync-status-icon:not(.sync-status-in-progress)')
            .on('click', () => syncService.syncNow());

        ws.subscribeToMessages(message => this.processMessage(message));
    }

    showIcon(className) {
        if (!options.get('syncServerHost')) {
            this.toggleInt(false);
            return;
        }

        this.$widget.show();
        this.$widget.find('.sync-status-icon').hide();
        this.$widget.find(`.sync-status-${className}`).show();
    }

    processMessage(message) {
        if (message.type === 'sync-pull-in-progress') {
            this.syncState = 'in-progress';
            this.lastSyncedPush = message.lastSyncedPush;
        }
        else if (message.type === 'sync-push-in-progress') {
            this.syncState = 'in-progress';
            this.lastSyncedPush = message.lastSyncedPush;
        }
        else if (message.type === 'sync-finished') {
            this.syncState = 'connected';
            this.lastSyncedPush = message.lastSyncedPush;
        }
        else if (message.type === 'sync-failed') {
            this.syncState = 'disconnected';
            this.lastSyncedPush = message.lastSyncedPush;
        }
        else if (message.type === 'frontend-update') {
            this.lastSyncedPush = message.data.lastSyncedPush;
        }

        this.allChangesPushed = this.lastSyncedPush === ws.getMaxKnownEntityChangeSyncId();

        if (['unknown', 'in-progress'].includes(this.syncState)) {
            this.showIcon(this.syncState);
        } else {
            this.showIcon(`${this.syncState}-${this.allChangesPushed ? 'no-changes' : 'with-changes'}`);
        }
    }
}
