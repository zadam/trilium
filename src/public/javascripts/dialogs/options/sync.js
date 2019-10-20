import server from "../../services/server.js";
import toastService from "../../services/toast.js";

export default class SyncOptions {
    constructor() {
        this.$form = $("#sync-setup-form");
        this.$syncServerHost = $("#sync-server-host");
        this.$syncServerTimeout = $("#sync-server-timeout");
        this.$syncProxy = $("#sync-proxy");
        this.$testSyncButton = $("#test-sync-button");

        this.$form.submit(() => this.save());

        this.$testSyncButton.click(async () => {
            const result = await server.post('sync/test');

            if (result.success) {
                toastService.showMessage(result.message);
            }
            else {
                toastService.showError("Sync server handshake failed, error: " + result.message);
            }
        });
    }

    optionsLoaded(options) {
        this.$syncServerHost.val(options['syncServerHost']);
        this.$syncServerTimeout.val(options['syncServerTimeout']);
        this.$syncProxy.val(options['syncProxy']);
    }

    save() {
        const opts = {
            'syncServerHost': this.$syncServerHost.val(),
            'syncServerTimeout': this.$syncServerTimeout.val(),
            'syncProxy': this.$syncProxy.val()
        };

        server.put('options', opts).then(()  => toastService.showMessage("Options change have been saved."));

        return false;
    }
}