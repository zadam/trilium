import server from "../../../services/server.js";
import toastService from "../../../services/toast.js";
import OptionsWidget from "./options_widget.js";

const TPL = `
<div class="options-section">
    <h4 style="margin-top: 0px;">Sync Configuration</h4>
    
    <form class="sync-setup-form">
        <div class="form-group">
            <label>Server instance address</label>
            <input class="sync-server-host form-control" placeholder="https://<host>:<port>">
        </div>
    
        <div class="form-group">
            <label>Sync timeout (milliseconds)</label>
            <input class="sync-server-timeout form-control" min="1" max="10000000" type="number" style="text-align: left;">
        </div>
    
        <div class="form-group">
            <label>Sync proxy server (optional)</label>
            <input class="sync-proxy form-control" placeholder="https://<host>:<port>">
    
            <p><strong>Note:</strong> If you leave the proxy setting blank, the system proxy will be used (applies to desktop/electron build only).</p>
            <p>Another special value is <code>noproxy</code> which forces ignoring even the system proxy and respectes <code>NODE_TLS_REJECT_UNAUTHORIZED</code>.</p>
        </div>
    
        <div style="display: flex; justify-content: space-between;">
            <button class="btn btn-primary">Save</button>
    
            <button class="btn" type="button" data-help-page="Synchronization">Help</button>
        </div>
    </form>
</div>

<div class="options-section">
    <h4>Sync Test</h4>
    
    <p>This will test the connection and handshake to the sync server. If the sync server isn't initialized, this will set it up to sync with the local document.</p>
    
    <button class="test-sync-button btn">Test sync</button>
</div>`;

export default class SyncOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$form = this.$widget.find(".sync-setup-form");
        this.$syncServerHost = this.$widget.find(".sync-server-host");
        this.$syncServerTimeout = this.$widget.find(".sync-server-timeout");
        this.$syncProxy = this.$widget.find(".sync-proxy");
        this.$testSyncButton = this.$widget.find(".test-sync-button");

        this.$form.on('submit', () => this.save());

        this.$testSyncButton.on('click', async () => {
            const result = await server.post('sync/test');

            if (result.success) {
                toastService.showMessage(result.message);
            }
            else {
                toastService.showError(`Sync server handshake failed, error: ${result.message}`);
            }
        });
    }

    optionsLoaded(options) {
        this.$syncServerHost.val(options.syncServerHost);
        this.$syncServerTimeout.val(options.syncServerTimeout);
        this.$syncProxy.val(options.syncProxy);
    }

    save() {
        this.updateMultipleOptions({
            'syncServerHost': this.$syncServerHost.val(),
            'syncServerTimeout': this.$syncServerTimeout.val(),
            'syncProxy': this.$syncProxy.val()
        });

        return false;
    }
}
