import BasicWidget from "../basic_widget.js";

const WIDGET_TPL = `
<div id="global-buttons">
    <style>
    #global-buttons {
        display: flex;
        flex-shrink: 0;
        justify-content: space-around;
        padding: 3px 0 3px 0;
        margin: 0 10px 0 16px;
        font-size: larger;
    }
    </style>

    <a data-trigger-command="createTopLevelNote" title="Create new top level note" class="icon-action bx bx-folder-plus"></a>

    <a data-trigger-command="collapseTree" title="Collapse note tree" class="icon-action bx bx-layer-minus"></a>

    <a data-trigger-command="scrollToActiveNote" title="Scroll to active note" class="icon-action bx bx-crosshair"></a>

    <div class="dropdown">
        <a title="Global actions" class="icon-action bx bx-cog dropdown-toggle" data-toggle="dropdown"></a>

        <div class="dropdown-menu dropdown-menu-right">
            <a class="dropdown-item" data-trigger-command="switchToDesktopVersion"><span class="bx bx-laptop"></span> Switch to desktop version</a>
            <a class="dropdown-item" data-trigger-command="logout"><span class="bx bx-log-out"></span> Logout</a>
        </div>
    </div>
</div>
`;

class MobileGlobalButtonsWidget extends BasicWidget {
    doRender() {
        return this.$widget = $(WIDGET_TPL);
    }
}

export default MobileGlobalButtonsWidget;