import server from "../../../services/server.js";
import dialogService from "../../../services/dialog.js";
import toastService from "../../../services/toast.js";
import OptionsWidget from "./options_widget.js";

const TPL = `
<div class="options-section">
    <h4>ETAPI</h4>
    
    <p>ETAPI is a REST API used to access Trilium instance programmatically, without UI. <br/>
       See more details on <a href="https://github.com/zadam/trilium/wiki/ETAPI">wiki</a> and <a onclick="window.open('etapi/etapi.openapi.yaml')" href="etapi/etapi.openapi.yaml">ETAPI OpenAPI spec</a>.</p>
    
    <button type="button" class="create-etapi-token btn btn-sm">Create new ETAPI token</button>

    <h5>Existing tokens</h5>
    
    <div class="no-tokens-yet">There are no tokens yet. Click on the button above to create one.</div>
    
    <div style="overflow: auto; height: 500px;">
        <table class="tokens-table table table-stripped">
        <thead>
            <tr>
                <th>Token name</th>
                <th>Created</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody></tbody>
        </table>
    </div>
</div>

<style>
    .token-table-button {
        display: inline-block;
        cursor: pointer;
        padding: 3px;
        margin-right: 20px;
        font-size: large;
        border: 1px solid transparent;
        border-radius: var(--button-border-radius);
    }
    
    .token-table-button:hover {
        border: 1px solid var(--button-border-color);
    }
</style>`;

export default class EtapiOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$widget.find(".create-etapi-token").on("click", async () => {
            const tokenName = await dialogService.prompt({
                title: "New ETAPI token",
                message: "Please enter new token's name",
                defaultValue: "new token"
            });

            if (!tokenName.trim()) {
                toastService.showError("Token name can't be empty");
                return;
            }

            const {authToken} = await server.post('etapi-tokens', {tokenName});

            await dialogService.prompt({
                title: "ETAPI token created",
                message: 'Copy the created token into clipboard. Trilium stores the token hashed and this is the last time you see it.',
                defaultValue: authToken
            });

            this.refreshTokens();
        });

        this.refreshTokens();
    }

    async refreshTokens() {
        const $noTokensYet = this.$widget.find(".no-tokens-yet");
        const $tokensTable = this.$widget.find(".tokens-table");

        const tokens = await server.get('etapi-tokens');

        $noTokensYet.toggle(tokens.length === 0);
        $tokensTable.toggle(tokens.length > 0);

        const $tokensTableBody = $tokensTable.find("tbody");
        $tokensTableBody.empty();

        for (const token of tokens) {
            $tokensTableBody.append(
                $("<tr>")
                    .append($("<td>").text(token.name))
                    .append($("<td>").text(token.utcDateCreated))
                    .append($("<td>").append(
                        $('<span class="bx bx-pen token-table-button" title="Rename this token"></span>')
                            .on("click", () => this.renameToken(token.etapiTokenId, token.name)),
                        $('<span class="bx bx-trash token-table-button" title="Delete / deactive this token"></span>')
                            .on("click", () => this.deleteToken(token.etapiTokenId, token.name))
                    ))
            );
        }
    }

    async renameToken(etapiTokenId, oldName) {
        const tokenName = await dialogService.prompt({
            title: "Rename token",
            message: "Please enter new token's name",
            defaultValue: oldName
        });

        await server.patch(`etapi-tokens/${etapiTokenId}`, {name: tokenName});

        this.refreshTokens();
    }

    async deleteToken(etapiTokenId, name) {
        if (!await dialogService.confirm(`Are you sure you want to delete ETAPI token "${name}"?`)) {
            return;
        }

        await server.remove(`etapi-tokens/${etapiTokenId}`);

        this.refreshTokens();
    }
}
