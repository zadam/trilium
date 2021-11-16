import utils from "./services/utils.js";
import macInit from './services/mac_init.js';

macInit.init();

function SetupModel() {
    if (syncInProgress) {
        setInterval(checkOutstandingSyncs, 1000);
    }

    const serverAddress = location.protocol + '//' + location.host;

    $("#current-host").html(serverAddress);

    this.step = ko.observable(syncInProgress ? "sync-in-progress" : "setup-type");
    this.setupType = ko.observable();

    this.setupNewDocument = ko.observable(false);
    this.setupSyncFromDesktop = ko.observable(false);
    this.setupSyncFromServer = ko.observable(false);

    this.username = ko.observable();
    this.password1 = ko.observable();
    this.password2 = ko.observable();

    this.theme = ko.observable("light");
    this.syncServerHost = ko.observable();
    this.syncProxy = ko.observable();

    this.instanceType = utils.isElectron() ? "desktop" : "server";

    this.setupTypeSelected = () => !!this.setupType();

    this.selectSetupType = () => {
        this.step(this.setupType());
    };

    this.back = () => {
        this.step("setup-type");

        this.setupType("");
    };

    this.finish = async () => {
        if (this.setupType() === 'new-document') {
            const username = this.username();
            const password1 = this.password1();
            const password2 = this.password2();
            const theme = this.theme();

            if (!username) {
                showAlert("Username can't be empty");
                return;
            }

            if (!password1) {
                showAlert("Password can't be empty");
                return;
            }

            if (password1 !== password2) {
                showAlert("Both password fields need be identical.");
                return;
            }

            this.step('new-document-in-progress');

            // not using server.js because it loads too many dependencies
            $.post('api/setup/new-document', {
                username: username,
                password: password1,
                theme: theme
            }).then(() => {
                window.location.replace("./setup");
            });
        }
        else if (this.setupType() === 'sync-from-server') {
            const syncServerHost = this.syncServerHost();
            const syncProxy = this.syncProxy();
            const username = this.username();
            const password = this.password1();

            if (!syncServerHost) {
                showAlert("Trilium server address can't be empty");
                return;
            }

            if (!username) {
                showAlert("Username can't be empty");
                return;
            }

            if (!password) {
                showAlert("Password can't be empty");
                return;
            }

            // not using server.js because it loads too many dependencies
            const resp = await $.post('api/setup/sync-from-server', {
                syncServerHost: syncServerHost,
                syncProxy: syncProxy,
                username: username,
                password: password
            });

            if (resp.result === 'success') {
                this.step('sync-in-progress');

                setInterval(checkOutstandingSyncs, 1000);

                hideAlert();
            }
            else {
                showAlert('Sync setup failed: ' + resp.error);
            }
        }
    };
}

async function checkOutstandingSyncs() {
    const { outstandingPullCount, initialized } = await $.get('api/sync/stats');

    if (initialized) {
        if (utils.isElectron()) {
            const remote = utils.dynamicRequire('@electron/remote');
            remote.app.relaunch();
            remote.app.exit(0);
        }
        else {
            utils.reloadFrontendApp();
        }
    }
    else {
        $("#outstanding-syncs").html(outstandingPullCount);
    }
}

function showAlert(message) {
    $("#alert").html(message);
    $("#alert").show();
}

function hideAlert() {
    $("#alert").hide();
}

ko.applyBindings(new SetupModel(), document.getElementById('setup-dialog'));

$("#setup-dialog").show();
