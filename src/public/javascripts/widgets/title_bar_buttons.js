import BasicWidget from "./basic_widget.js";
import optionService from "../services/options.js";
import utils from "../services/utils.js";

const TPL = `
<div class="title-bar-buttons">
    <style>
    .title-bar-buttons {
        margin-top: 4px;
        min-width: 100px;
        display: none;
    }
    </style>

    <button class="btn icon-action bx bx-minus minimize-btn"></button>
    <button class="btn icon-action bx bx-checkbox maximize-btn"></button>
    <button class="btn icon-action bx bx-x close-btn"></button>
</div>`;

export default class TitleBarButtonsWidget extends BasicWidget {
    doRender() {
        if (!utils.isElectron()) {
            return;
        }

        this.$widget = $(TPL);

        optionService.waitForOptions().then(options => {
            if (!options.is('nativeTitleBarVisible')) {
                this.$widget.show();

                const $minimizeBtn = this.$widget.find(".minimize-btn");
                const $maximizeBtn = this.$widget.find(".maximize-btn");
                const $closeBtn = this.$widget.find(".close-btn");

                $minimizeBtn.on('click', () => {
                    $minimizeBtn.trigger('blur');
                    const {remote} = require('electron');
                    remote.BrowserWindow.getFocusedWindow().minimize();
                });

                $maximizeBtn.on('click', () => {
                    $maximizeBtn.trigger('blur');
                    const {remote} = require('electron');
                    const focusedWindow = remote.BrowserWindow.getFocusedWindow();

                    if (focusedWindow.isMaximized()) {
                        focusedWindow.unmaximize();
                    } else {
                        focusedWindow.maximize();
                    }
                });

                $closeBtn.on('click', () => {
                    $closeBtn.trigger('blur');
                    const {remote} = require('electron');
                    remote.BrowserWindow.getFocusedWindow().close();
                });
            }
        });

        return this.$widget;
    }
}