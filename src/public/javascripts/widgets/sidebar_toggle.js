import options from "../services/options.js";
import splitService from "../services/split.js";
import BasicWidget from "./basic_widget.js";

const TPL = `
<div>
    <style>
    #hide-right-pane-button, #show-right-pane-button {
        position: fixed;
        bottom: 10px;
        right: 10px;
        z-index: 1000;
    }
    
    #hide-left-pane-button, #show-left-pane-button {
        position: fixed;
        bottom: 10px;
        left: 10px;
        z-index: 1000;
    }
    </style>
    
    <button id="hide-left-pane-button" class="btn btn-sm icon-button bx bx-chevrons-left hide-in-zen-mode" title="Show sidebar"></button>
    <button id="show-left-pane-button" class="btn btn-sm icon-button bx bx-chevrons-right hide-in-zen-mode" title="Hide sidebar"></button>
            
    <button id="hide-right-pane-button" class="btn btn-sm icon-button bx bx-chevrons-right hide-in-zen-mode" title="Hide sidebar"></button>
    <button id="show-right-pane-button" class="btn btn-sm icon-button bx bx-chevrons-left hide-in-zen-mode" title="Show sidebar"></button>
</div>
`;

export default class SidebarToggle extends BasicWidget {
    constructor(appContext) {
        super(appContext);

        this.paneVisible = {};
    }

    doRender() {
        this.$widget = $(TPL);

        this.toggleSidebar('left', options.is('leftPaneVisible'));
        this.toggleSidebar('right', options.is('rightPaneVisible'));

        $("#show-right-pane-button").on('click', () => toggleAndSave('right', true));
        $("#hide-right-pane-button").on('click', () => toggleAndSave('right', false));

        $("#show-left-pane-button").on('click', () => toggleAndSave('left', true));
        $("#hide-left-pane-button").on('click', () => toggleAndSave('left', false));

        splitService.setupSplit(this.paneVisible.left, this.paneVisible.right);

        return this.$widget;
    }

    toggleSidebar(side, show) {
        $(`#${side}-pane`).toggle(show);
        $(`#show-${side}-pane-button`).toggle(!show);
        $(`#hide-${side}-pane-button`).toggle(show);

        this.paneVisible[side] = show;
    }

    async toggleAndSave(side, show) {
        this.toggleSidebar(side, show);

        await options.save(`${side}PaneVisible`, show.toString());

        splitService.setupSplit(this.paneVisible.left, this.paneVisible.right);

        this.trigger('sidebarVisibilityChanged', {side, show});
    }
}
