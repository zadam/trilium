import server from "../../services/server.js";
import utils from "../../services/utils.js";
import cssLoader from "../../services/css_loader.js";
import zoomService from "../../services/zoom.js";
import optionsInit from "../../services/options_init.js";

export default class ApperanceOptions {
    constructor() {
        this.$themeSelect = $("#theme-select");
        this.$zoomFactorSelect = $("#zoom-factor-select");
        this.$oneTabDisplaySelect = $("#one-tab-display-select");
        this.$leftPaneMinWidth = $("#left-pane-min-width");
        this.$leftPaneWidthPercent = $("#left-pane-width-percent");
        this.$mainFontSize = $("#main-font-size");
        this.$treeFontSize = $("#tree-font-size");
        this.$detailFontSize = $("#detail-font-size");
        this.$body = $("body");
        this.$container = $("#container");

        this.$themeSelect.change(() => {
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
                cssLoader.requireCss(`/api/notes/download/${noteId}`);
            }

            this.$body.addClass("theme-" + newTheme);

            server.put('options/theme/' + newTheme);
        });

        this.$zoomFactorSelect.change(() => { zoomService.setZoomFactorAndSave(this.$zoomFactorSelect.val()); });

        this.$oneTabDisplaySelect.change(() => {
            const hideTabRowForOneTab = this.$oneTabDisplaySelect.val() === 'hide' ? 'true' : 'false';

            server.put('options/hideTabRowForOneTab/' + hideTabRowForOneTab)
                .then(optionsInit.reloadOptions);
        });

        this.$leftPaneMinWidth.change(async () => {
            await server.put('options/leftPaneMinWidth/' + this.$leftPaneMinWidth.val());

            this.resizeLeftPanel();
        });

        this.$leftPaneWidthPercent.change(async () => {
            await server.put('options/leftPaneWidthPercent/' + this.$leftPaneWidthPercent.val());

            this.resizeLeftPanel();
        });

        this.$mainFontSize.change(async () => {
            await server.put('options/mainFontSize/' + this.$mainFontSize.val());

            this.applyFontSizes();
        });

        this.$treeFontSize.change(async () => {
            await server.put('options/treeFontSize/' + this.$treeFontSize.val());

            this.applyFontSizes();
        });

        this.$detailFontSize.change(async () => {
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

        this.$oneTabDisplaySelect.val(options.hideTabRowForOneTab === 'true' ? 'hide' : 'show');

        this.$leftPaneMinWidth.val(options.leftPaneMinWidth);
        this.$leftPaneWidthPercent.val(options.leftPaneWidthPercent);

        this.$mainFontSize.val(options.mainFontSize);
        this.$treeFontSize.val(options.treeFontSize);
        this.$detailFontSize.val(options.detailFontSize);
    }

    resizeLeftPanel() {
        const leftPanePercent = parseInt(this.$leftPaneWidthPercent.val());
        const rightPanePercent = 100 - leftPanePercent;
        const leftPaneMinWidth = this.$leftPaneMinWidth.val();

        this.$container.css("grid-template-columns", `minmax(${leftPaneMinWidth}px, ${leftPanePercent}fr) ${rightPanePercent}fr`);
    }

    applyFontSizes() {
        this.$body.get(0).style.setProperty("--main-font-size", this.$mainFontSize.val() + "%");
        this.$body.get(0).style.setProperty("--tree-font-size", this.$treeFontSize.val() + "%");
        this.$body.get(0).style.setProperty("--detail-font-size", this.$detailFontSize.val() + "%");
    }
}