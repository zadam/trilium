import server from './services/server.js';
import utils from "./services/utils.js";

function SetupModel() {
    this.step = ko.observable("setup-type");
    this.setupType = ko.observable();

    this.setupNewDocument = ko.observable(false);
    this.setupSyncFromDesktop = ko.observable(false);
    this.setupSyncFromServer = ko.observable(false);

    this.username = ko.observable();
    this.password1 = ko.observable();
    this.password2 = ko.observable();

    this.serverAddress = ko.observable();

    this.instanceType = utils.isElectron() ? "desktop" : "server";

    this.setupTypeSelected = this.getSetupType = () =>
        this.setupNewDocument()
        || this.setupSyncFromDesktop()
        || this.setupSyncFromServer();

    this.selectSetupType = () => {
        this.step(this.getSetupType());
        this.setupType(this.getSetupType());
    };

    this.back = () => {
        this.step("setup-type");

        this.setupNewDocument(false);
        this.setupSyncFromServer(false);
        this.setupSyncFromDesktop(false);
    };

    this.finish = () => {
        if (this.setupNewDocument()) {
            const username = this.username();
            const password1 = this.password1();
            const password2 = this.password2();

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

            server.post('setup', {
                username: username,
                password: password1
            }).then(() => {
                window.location.replace("/");
            });
        }
        else if (this.setupSyncFromServer()) {
            const serverAddress = this.serverAddress();
            const username = this.username();
            const password = this.password1();

            if (!serverAddress) {
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

            showAlert("All OK");
        }
    };
}

function showAlert(message) {
    $("#alert").html(message);
    $("#alert").show();
}

ko.applyBindings(new SetupModel(), document.getElementById('setup-dialog'));

$("#setup-dialog").show();