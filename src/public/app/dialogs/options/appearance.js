import server from "../../services/server.js";
import utils from "../../services/utils.js";
import appContext from "../../services/app_context.js";
import libraryLoader from "../../services/library_loader.js";

const TPL = `
<p><strong>Settings on this options tab are saved automatically after each change.</strong></p>

<form>
    <div class="form-group row">
        <div class="col-4">
            <label for="theme-select">Theme</label>
            <select class="form-control" id="theme-select"></select>
        </div>

        <div class="col-4">
            <label for="zoom-factor-select">Zoom factor (desktop build only)</label>

            <input type="number" class="form-control" id="zoom-factor-select" min="0.3" max="2.0" step="0.1"/>
        </div>
        
        <div class="col-4">
            <label for="native-title-bar-select">Native title bar (requires app restart)</label>

            <select class="form-control" id="native-title-bar-select">
                <option value="show">enabled</option>
                <option value="hide">disabled</option>
            </select>
        </div>
    </div>

    <p>Zooming can be controlled with CTRL-+ and CTRL-= shortcuts as well.</p>

    <h4>Font sizes</h4>

    <div class="form-group row">
        <div class="col-4">
            <label for="main-font-size">Main font size</label>

            <div class="input-group">
                <input type="number" class="form-control" id="main-font-size" min="50" max="200" step="10"/>
                <div class="input-group-append">
                    <span class="input-group-text">%</span>
                </div>
            </div>
        </div>

        <div class="col-4">
            <label for="tree-font-size">Note tree font size</label>

            <div class="input-group">
                <input type="number" class="form-control" id="tree-font-size" min="50" max="200" step="10"/>
                <div class="input-group-append">
                    <span class="input-group-text">%</span>
                </div>
            </div>
        </div>

        <div class="col-4">
            <label for="detail-font-size">Note detail font size</label>

            <div class="input-group">
                <input type="number" class="form-control" id="detail-font-size" min="50" max="200" step="10"/>
                <div class="input-group-append">
                    <span class="input-group-text">%</span>
                </div>
            </div>
        </div>
    </div>

    <p>Note that tree and detail font sizing is relative to the main font size setting.</p>
</form>`;

export default class ApperanceOptions {
    constructor() {
        $("#options-appearance").html(TPL);

        this.$themeSelect = $("#theme-select");
        this.$zoomFactorSelect = $("#zoom-factor-select");
        this.$nativeTitleBarSelect = $("#native-title-bar-select");
        this.$mainFontSize = $("#main-font-size");
        this.$treeFontSize = $("#tree-font-size");
        this.$detailFontSize = $("#detail-font-size");
        this.$body = $("body");

        this.$themeSelect.on('change', () => {
            const newTheme = this.$themeSelect.val();

            for (const clazz of Array.from(this.$body[0].classList)) { // create copy to safely iterate over while removing classes
                if (clazz.startsWith("theme-")) {
                    this.$body.removeClass(clazz);
                }
            }

            const noteId = $(this).find(":selected").attr("data-note-id");

            if (noteId) {
                // make sure the CSS is loaded
                // if the CSS has been loaded and then updated then the changes won't take effect though
                libraryLoader.requireCss(`api/notes/download/${noteId}`);
            }

            this.$body.addClass("theme-" + newTheme);

            server.put('options/theme/' + newTheme);
        });

        this.$zoomFactorSelect.on('change', () => { appContext.triggerCommand('setZoomFactorAndSave', {zoomFactor: this.$zoomFactorSelect.val()}); });

        this.$nativeTitleBarSelect.on('change', () => {
            const nativeTitleBarVisible = this.$nativeTitleBarSelect.val() === 'show' ? 'true' : 'false';

            server.put('options/nativeTitleBarVisible/' + nativeTitleBarVisible);
        });

        this.$mainFontSize.on('change', async () => {
            await server.put('options/mainFontSize/' + this.$mainFontSize.val());

            this.applyFontSizes();
        });

        this.$treeFontSize.on('change', async () => {
            await server.put('options/treeFontSize/' + this.$treeFontSize.val());

            this.applyFontSizes();
        });

        this.$detailFontSize.on('change', async () => {
            await server.put('options/detailFontSize/' + this.$detailFontSize.val());

            this.applyFontSizes();
        });
    }

    async optionsLoaded(options) {
        const themes = [
            { val: 'white', title: 'White' },
            { val: 'dark', title: 'Dark' },
            { val: 'black', title: 'Black' }
        ].concat(await server.get('options/user-themes'));

        this.$themeSelect.empty();

        for (const theme of themes) {
            this.$themeSelect.append($("<option>")
                .attr("value", theme.val)
                .attr("data-note-id", theme.noteId)
                .html(theme.title));
        }

        this.$themeSelect.val(options.theme);

        if (utils.isElectron()) {
            this.$zoomFactorSelect.val(options.zoomFactor);
        }
        else {
            this.$zoomFactorSelect.prop('disabled', true);
        }

        this.$nativeTitleBarSelect.val(options.nativeTitleBarVisible === 'true' ? 'show' : 'hide');

        this.$mainFontSize.val(options.mainFontSize);
        this.$treeFontSize.val(options.treeFontSize);
        this.$detailFontSize.val(options.detailFontSize);
    }

    applyFontSizes() {
        this.$body.get(0).style.setProperty("--main-font-size", this.$mainFontSize.val() + "%");
        this.$body.get(0).style.setProperty("--tree-font-size", this.$treeFontSize.val() + "%");
        this.$body.get(0).style.setProperty("--detail-font-size", this.$detailFontSize.val() + "%");
    }
}