import BasicWidget from "./basic_widget.js";
import HistoryNavigationWidget from "./history_navigation.js";
import keyboardActionService from "../services/keyboard_actions.js";
import protectedSessionService from "../services/protected_session.js";

const JUMP_TO_NOTE = "../dialogs/jump_to_note.js";
const RECENT_CHANGES = "../dialogs/recent_changes.js";

const TPL = `
<div class="standard-top-widget">
    <style>
    .standard-top-widget {
        background-color: var(--header-background-color);
        display: flex;
        align-items: center;
        padding-top: 4px;
    }
    
    .standard-top-widget button {
        padding: 1px 5px 1px 5px;
        font-size: smaller;
        margin-bottom: 2px;
        margin-top: 2px;
        margin-right: 8px;
        border-color: transparent !important;
    }
    
    .standard-top-widget button.btn-sm .bx {
        position: relative;
        top: 1px;
    }
    
    .standard-top-widget button:hover {
        border-color: var(--button-border-color) !important;
    }
    </style>

    <div style="flex-grow: 100; display: flex;">
        <button class="btn btn-sm jump-to-note-dialog-button" data-kb-action="JumpToNote">
            <span class="bx bx-crosshair"></span>
            Jump to note
        </button>
    
        <button class="btn btn-sm recent-changes-button" data-kb-action="ShowRecentChanges">
            <span class="bx bx-history"></span>
    
            Recent changes
        </button>
    
        <button class="btn btn-sm enter-protected-session-button"
                title="Enter protected session to be able to find and view protected notes">
            <span class="bx bx-log-in"></span>
    
            Enter protected session
        </button>
    
        <button class="btn btn-sm leave-protected-session-button"
                title="Leave protected session so that protected notes are not accessible any more."
                style="display: none;">
            <span class="bx bx-log-out"></span>
    
            Leave protected session
        </button>
    </div>
    
    <div id="plugin-buttons"></div>
</div>`;

export default class StandardTopWidget extends BasicWidget {
    render() {
        this.$widget = $(TPL);

        const historyNavigationWidget = new HistoryNavigationWidget(this.appContext);

        this.$widget.prepend(historyNavigationWidget.render());

        const showJumpToNoteDialog = () => import(JUMP_TO_NOTE).then(d => d.showDialog());
        this.$widget.find(".jump-to-note-dialog-button").on('click', showJumpToNoteDialog);

        const showRecentChanges = () => import(RECENT_CHANGES).then(d => d.showDialog());
        this.$widget.find(".recent-changes-button").on('click', showRecentChanges);

        // FIXME
        keyboardActionService.setGlobalActionHandler("JumpToNote", showJumpToNoteDialog);
        keyboardActionService.setGlobalActionHandler("ShowRecentChanges", showRecentChanges);

        this.$widget.find(".enter-protected-session-button").on('click', protectedSessionService.enterProtectedSession);
        this.$widget.find(".leave-protected-session-button").on('click', protectedSessionService.leaveProtectedSession);

        return this.$widget
    }
}