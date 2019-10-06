import optionsService from "../../services/options.js";
import server from "../../services/server.js";
import infoService from "../../services/info.js";

export default class ProtectedSessionOptions {
    constructor() {
        this.$spellCheckEnabled = $("#spell-check-enabled");
        this.$spellCheckLanguageCode = $("#spell-check-language-code");

        this.$protectedSessionTimeout = $("#protected-session-timeout-in-seconds");
        this.$noteRevisionsTimeInterval = $("#note-revision-snapshot-time-interval-in-seconds");

        this.$spellCheckEnabled.change(() => {
            const opts = { 'spellCheckEnabled': this.$spellCheckEnabled.is(":checked") ? "true" : "false" };
            server.put('options', opts).then(() => infoService.showMessage("Options change have been saved."));

            return false;
        });

        this.$spellCheckLanguageCode.change(() => {
            const opts = { 'spellCheckLanguageCode': this.$spellCheckLanguageCode.val() };
            server.put('options', opts).then(() => infoService.showMessage("Options change have been saved."));

            return false;
        });

        this.$protectedSessionTimeout.change(() => {
            const protectedSessionTimeout = this.$protectedSessionTimeout.val();

            server.put('options', { 'protectedSessionTimeout': protectedSessionTimeout }).then(() => {
                optionsService.reloadOptions();

                infoService.showMessage("Options change have been saved.");
            });

            return false;
        });

        this.$noteRevisionsTimeInterval.change(() => {
            const opts = { 'noteRevisionSnapshotTimeInterval': this.$noteRevisionsTimeInterval.val() };
            server.put('options', opts).then(() => infoService.showMessage("Options change have been saved."));

            return false;
        });
    }

    optionsLoaded(options) {
        this.$spellCheckEnabled.prop("checked", options['spellCheckEnabled'] === 'true');
        this.$spellCheckLanguageCode.val(options['spellCheckLanguageCode']);

        this.$protectedSessionTimeout.val(options['protectedSessionTimeout']);
        this.$noteRevisionsTimeInterval.val(options['noteRevisionSnapshotTimeInterval']);
    }
}