import optionsService from "../../services/options.js";
import server from "../../services/server.js";
import infoService from "../../services/info.js";

export default class ProtectedSessionOptions {
    constructor() {
        this.$form = $("#protected-session-timeout-form");
        this.$protectedSessionTimeout = $("#protected-session-timeout-in-seconds");

        this.$form.submit(() => this.save());
    }

    optionsLoaded(options) {
        this.$protectedSessionTimeout.val(options['protectedSessionTimeout']);
    }

    save() {
        const protectedSessionTimeout = this.$protectedSessionTimeout.val();

        server.put('options', { 'protectedSessionTimeout': protectedSessionTimeout }).then(() => {
            optionsService.reloadOptions();

            infoService.showMessage("Options change have been saved.");
        });

        return false;
    }
}