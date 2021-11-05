import BasicWidget from "../basic_widget.js";

const WIDGET_TPL = `
<div id="global-buttons">
    <style>
    #global-buttons {
        display: flex;
        flex-shrink: 0;
        justify-content: space-around;
        padding: 0px 0 3px 0;
        font-size: larger;
        position: absolute;
        top: 8px;
        width: 100%;
    }

    #plugin-buttons-placeholder {
        font-size: smaller;
        padding: 5px;
    }
    </style>

    <a data-trigger-command="createNoteIntoInbox" title="New note" class="icon-action bx bx-folder-plus"></a>

    <a data-trigger-command="collapseTree" title="Collapse note tree" class="icon-action bx bx-layer-minus"></a>

    <a data-trigger-command="scrollToActiveNote" title="Scroll to active note" class="icon-action bx bx-crosshair"></a>

    <div class="dropdown">
        <a title="Plugin buttons" class="icon-action bx bx-extension dropdown-toggle" data-toggle="dropdown"></a>

        <div id="plugin-buttons" class="dropdown-menu dropdown-menu-right">
            <p id="plugin-buttons-placeholder">No plugin buttons loaded yet.</p>
        </div>
    </div> 

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
        this.$widget = $(WIDGET_TPL);
    }
}

export default MobileGlobalButtonsWidget;
