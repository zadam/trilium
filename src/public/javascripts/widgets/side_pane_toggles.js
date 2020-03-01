import options from "../services/options.js";
import splitService from "../services/split.js";
import BasicWidget from "./basic_widget.js";

const TPL = `
<div class="hide-in-zen-mode">
    <style>
    .hide-right-pane-button, .show-right-pane-button {
        position: fixed;
        bottom: 10px;
        right: 10px;
        z-index: 1000;
    }
    
    .hide-left-pane-button, .show-left-pane-button {
        position: fixed;
        bottom: 10px;
        left: 10px;
        z-index: 1000;
    }
    </style>
    
    <button class="hide-left-pane-button btn btn-sm icon-button bx bx-chevrons-left" title="Show sidebar"></button>
    <button class="show-left-pane-button btn btn-sm icon-button bx bx-chevrons-right" title="Hide sidebar"></button>
            
    <button class="hide-right-pane-button btn btn-sm icon-button bx bx-chevrons-right" title="Hide sidebar"></button>
    <button class="show-right-pane-button btn btn-sm icon-button bx bx-chevrons-left" title="Show sidebar"></button>
</div>
`;

export default class SidePaneToggles extends BasicWidget {
    constructor() {
        super();

        this.paneVisible = {};
    }

    doRender() {
        this.$widget = $(TPL);

        this.$widget.find(".show-right-pane-button").on('click', () => this.toggleAndSave('right', true));
        this.$widget.find(".hide-right-pane-button").on('click', () => this.toggleAndSave('right', false));

        this.$widget.find(".show-left-pane-button").on('click', () => this.toggleAndSave('left', true));
        this.$widget.find(".hide-left-pane-button").on('click', () => this.toggleAndSave('left', false));

        return this.$widget;
    }

    toggleSidebar(side, show) {
        $(`#${side}-pane`).toggle(show);
        this.$widget.find(`.show-${side}-pane-button`).toggle(!show);
        this.$widget.find(`.hide-${side}-pane-button`).toggle(show);

        this.paneVisible[side] = show;
    }

    async toggleAndSave(side, show) {
        await options.save(`${side}PaneVisible`, show.toString());

        this.toggleSidebar(side, show);

        splitService.setupSplit(this.paneVisible.left, this.paneVisible.right);

        this.triggerEvent('sidebarVisibilityChanged', {side, show});
    }

    initialRenderCompleteEvent() {
        this.toggleSidebar('left', options.is('leftPaneVisible'));
        this.toggleSidebar('right', options.is('rightPaneVisible'));

        splitService.setupSplit(this.paneVisible.left, this.paneVisible.right);
    }
}
