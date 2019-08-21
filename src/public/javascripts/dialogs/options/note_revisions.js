import server from "../../services/server.js";
import infoService from "../../services/info.js";

export default class NoteRevisionsOptions {
    constructor() {
        this.$form = $("#note-revision-snapshot-time-interval-form");
        this.$timeInterval = $("#note-revision-snapshot-time-interval-in-seconds");

        this.$form.submit(() => {
            const opts = { 'noteRevisionSnapshotTimeInterval': this.$timeInterval.val() };
            server.put('options', opts).then(() => infoService.showMessage("Options change have been saved."));

            return false;
        });
    }

    optionsLoaded(options) {
        this.$timeInterval.val(options['noteRevisionSnapshotTimeInterval']);
    }
}