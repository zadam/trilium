import server from "../../services/server.js";
import utils from "../../services/utils.js";
import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="about-dialog modal fade mx-auto" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title mr-auto">About Trilium Notes</h5>

                <button type="button" class="close" data-dismiss="modal" aria-label="Close" style="margin-left: 0;">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <table class="table table-borderless">
                    <tr>
                        <th>Homepage:</th>
                        <td><a href="https://github.com/zadam/trilium" class="external">https://github.com/zadam/trilium</a></td>
                    </tr>
                    <tr>
                        <th>App version:</th>
                        <td class="app-version"></td>
                    </tr>
                    <tr>
                        <th>DB version:</th>
                        <td class="db-version"></td>
                    </tr>
                    <tr>
                        <th>Sync version:</th>
                        <td class="sync-version"></td>
                    </tr>
                    <tr>
                        <th>Build date:</th>
                        <td class="build-date"></td>
                    </tr>

                    <tr>
                        <th>Build revision:</th>
                        <td><a href="" class="build-revision external" target="_blank"></a></td>
                    </tr>

                    <tr>
                        <th>Data directory:</th>
                        <td class="data-directory"></td>
                    </tr>
                </table>
            </div>
        </div>
    </div>
</div>`;

export default class AboutDialog extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$appVersion = this.$widget.find(".app-version");
        this.$dbVersion = this.$widget.find(".db-version");
        this.$syncVersion = this.$widget.find(".sync-version");
        this.$buildDate = this.$widget.find(".build-date");
        this.$buildRevision = this.$widget.find(".build-revision");
        this.$dataDirectory = this.$widget.find(".data-directory");
    }

    async refresh() {
        const appInfo = await server.get('app-info');

        this.$appVersion.text(appInfo.appVersion);
        this.$dbVersion.text(appInfo.dbVersion);
        this.$syncVersion.text(appInfo.syncVersion);
        this.$buildDate.text(appInfo.buildDate);
        this.$buildRevision.text(appInfo.buildRevision);
        this.$buildRevision.attr('href', 'https://github.com/zadam/trilium/commit/' + appInfo.buildRevision);
        this.$dataDirectory.text(appInfo.dataDirectory);
    }

    async openAboutDialogEvent() {
        await this.refresh();

        utils.openDialog(this.$widget);
    }
}
