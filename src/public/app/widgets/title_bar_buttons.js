import BasicWidget from "./basic_widget.js";
import options from "../services/options.js";
import utils from "../services/utils.js";

const TPL = `
<div class="title-bar-buttons">
    <style>
    .title-bar-buttons {
        flex-shrink: 0;
    }

    .title-bar-buttons div button {
        border: none !important;
        border-radius: 0;
        background: none !important;
        font-size: 150%;
        height: 40px;
        width: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .title-bar-buttons div:hover button {
        background-color: var(--accented-background-color) !important;
    }

    .title-bar-buttons div {
        display: inline-block;
        height: 40px;
        width: 40px;
    }
    </style>

    <!-- divs act as a hitbox for the buttons, making them clickable on corners -->
    <div class="minimize-btn"><button class="btn bx bx-minus"></button></div>
    <div class="maximize-btn"><button class="btn bx bx-checkbox"></button></div>
    <div class="close-btn"><button class="btn bx bx-x"></button></div>
</div>`;

export default class TitleBarButtonsWidget extends BasicWidget {
    doRender() {
        if (!utils.isElectron() || options.is('nativeTitleBarVisible')) {
            return this.$widget = $('<div>');
        }

        this.$widget = $(TPL);
        this.contentSized();

        const $minimizeBtn = this.$widget.find(".minimize-btn");
        const $maximizeBtn = this.$widget.find(".maximize-btn");
        const $closeBtn = this.$widget.find(".close-btn");

        $minimizeBtn.on('click', () => {
            $minimizeBtn.trigger('blur');
            const remote = utils.dynamicRequire('@electron/remote');
            remote.BrowserWindow.getFocusedWindow().minimize();
        });

        $maximizeBtn.on('click', () => {
            $maximizeBtn.trigger('blur');
            const remote = utils.dynamicRequire('@electron/remote');
            const focusedWindow = remote.BrowserWindow.getFocusedWindow();

            if (focusedWindow.isMaximized()) {
                focusedWindow.unmaximize();
            } else {
                focusedWindow.maximize();
            }
        });

        $closeBtn.on('click', () => {
            $closeBtn.trigger('blur');
            const remote = utils.dynamicRequire('@electron/remote');
            remote.BrowserWindow.getFocusedWindow().close();
        });
    }
}
