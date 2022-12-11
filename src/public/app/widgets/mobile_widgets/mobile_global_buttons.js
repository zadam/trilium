import BasicWidget from "../basic_widget.js";
import protectedSessionHolder from "../../services/protected_session_holder.js";

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
    
    #global-buttons .global-button {
        border: 1px solid transparent;
        width: 60px;
        height: 40px;
        background: var(--button-background-color);
        border-radius: var(--button-border-radius);
        color: var(--button-text-color);
        display: flex;
        justify-content: space-around;
        align-items: center;
    }
    
    #global-buttons .global-button > .bx {
        font-size: 1.5em;
        color: var(--button-text-color);
        cursor: pointer;
    }
    
    #global-buttons .global-button:hover {
        text-decoration: none;
        border-color: var(--button-border-color);
    }
    </style>

    <button data-trigger-command="createNoteIntoInbox" title="New note" class="global-button">
        <span class="bx bx-folder-plus"></span>
    </button>
    <button data-trigger-command="collapseTree" title="Collapse note tree" class="global-button">
        <span class="bx bx-layer-minus">
    </button>
    <button data-trigger-command="scrollToActiveNote" title="Scroll to active note" class="global-button">
        <span class="bx bx-crosshair"></span>
    </button>

    <div class="dropdown global-button">
        <span title="Plugin buttons" class="bx bx-extension dropdown-toggle" data-toggle="dropdown"></span>

        <div id="plugin-buttons" class="dropdown-menu dropdown-menu-right">
            <p id="plugin-buttons-placeholder">No plugin buttons loaded yet.</p>
        </div>
    </div> 

    <div class="dropdown global-button">
        <span title="Global actions" class="bx bx-cog dropdown-toggle" data-toggle="dropdown"></span>

        <div class="dropdown-menu dropdown-menu-right">
            <a class="dropdown-item" data-trigger-command="switchToDesktopVersion"><span class="bx bx-laptop"></span> Switch to desktop version</a>
            <a class="dropdown-item" data-trigger-command="enterProtectedSession"><span class="bx bx-shield-quarter"></span> Enter protected session</a>
            <a class="dropdown-item" data-trigger-command="leaveProtectedSession"><span class="bx bx-check-shield"></span> Leave protected session</a>
            <a class="dropdown-item" data-trigger-command="logout"><span class="bx bx-log-out"></span> Logout</a>
        </div>
    </div>
</div>
`;

class MobileGlobalButtonsWidget extends BasicWidget {
    doRender() {
        this.$widget = $(WIDGET_TPL);
        this.updateSettings();
    }

    protectedSessionStartedEvent() {
        this.updateSettings();
    }

    updateSettings() {
        const protectedSession = protectedSessionHolder.isProtectedSessionAvailable();

        this.$widget.find('[data-trigger-command="enterProtectedSession"]').toggle(!protectedSession);
        this.$widget.find('[data-trigger-command="leaveProtectedSession"]').toggle(protectedSession);
    }
}

export default MobileGlobalButtonsWidget;
