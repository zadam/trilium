import BasicWidget from "./basic_widget.js";
import options from "../services/options.js";
import utils from "../services/utils.js";

const TPL = `
<div class="title-bar-buttons">
    <style>
    .title-bar-buttons {
        margin-top: 4px;
        flex-shrink: 0;
    }
    
    .title-bar-buttons button {
        border: none !important;
        background: none !important;
        font-size: 150%;
        padding-left: 10px;
        padding-right: 10px;
    }
    </style>

    <button class="btn icon-action bx bx-minus minimize-btn"></button>
    <button class="btn icon-action bx bx-checkbox maximize-btn"></button>
    <button class="btn icon-action bx bx-x close-btn"></button>
</div>`;

export default class TitleBarButtonsWidget extends BasicWidget {
    doRender() {
        if (!utils.isElectron() || options.is('nativeTitleBarVisible')) {
            return this.$widget = $('<div>');
        }

        this.$widget = $(TPL);

        const $minimizeBtn = this.$widget.find(".minimize-btn");
        const $maximizeBtn = this.$widget.find(".maximize-btn");
        const $closeBtn = this.$widget.find(".close-btn");

        $minimizeBtn.on('click', () => {
            $minimizeBtn.trigger('blur');
            const {remote} = utils.dynamicRequire('electron');
            remote.BrowserWindow.getFocusedWindow().minimize();
        });

        $maximizeBtn.on('click', () => {
            $maximizeBtn.trigger('blur');
            const {remote} = utils.dynamicRequire('electron');
            const focusedWindow = remote.BrowserWindow.getFocusedWindow();

            if (focusedWindow.isMaximized()) {
                focusedWindow.unmaximize();
            } else {
                focusedWindow.maximize();
            }
        });

        $closeBtn.on('click', () => {
            $closeBtn.trigger('blur');
            const {remote} = utils.dynamicRequire('electron');
            remote.BrowserWindow.getFocusedWindow().close();
        });

        return this.$widget;
    }
}