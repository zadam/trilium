import BasicWidget from "./basic_widget.js";
import HistoryNavigationWidget from "./history_navigation.js";
import protectedSessionService from "../services/protected_session.js";
import QuickSearchWidget from "./quick_search.js";

const TPL = `
<div class="standard-top-widget">
    <style>
    .standard-top-widget {
        background-color: var(--header-background-color);
        display: flex;
        align-items: center;
        padding-top: 4px;
        height: 35px;
    }
    
    .standard-top-widget button:not(.search-button) {
        padding: 1px 5px 1px 5px;
        font-size: 90%;
        margin-bottom: 2px;
        margin-top: 2px;
        margin-right: 8px;
        border-color: transparent !important;
    }
    
    .standard-top-widget button.btn-sm .bx {
        position: relative;
        top: 2px;
        font-size: 120%;
    }
    
    .standard-top-widget button:hover {
        border-color: var(--button-border-color) !important;
    }
    </style>

    <div style="flex-grow: 100; display: flex;">
        <button class="btn btn-sm" data-trigger-command="createNoteIntoInbox">
            <span class="bx bx-file-blank"></span>
            New note
        </button>
        
        <button class="btn btn-sm" data-trigger-command="searchNotes">
            <span class="bx bx-search"></span>
            Search
        </button>
    
        <button class="btn btn-sm" data-trigger-command="jumpToNote">
            <span class="bx bx-send"></span>
            Jump to note
        </button>
    
        <button class="btn btn-sm" data-trigger-command="showRecentChanges">
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
    doRender() {
        this.$widget = $(TPL);
        this.overflowing();

        const historyNavigationWidget = new HistoryNavigationWidget();
        this.child(historyNavigationWidget);

        this.$widget.prepend(historyNavigationWidget.render());

        const quickSearchWidget = new QuickSearchWidget();
        this.child(quickSearchWidget);

        this.$widget.append(quickSearchWidget.render());

        this.$enterProtectedSessionButton = this.$widget.find(".enter-protected-session-button");
        this.$enterProtectedSessionButton.on('click', protectedSessionService.enterProtectedSession);

        this.$leaveProtectedSessionButton = this.$widget.find(".leave-protected-session-button");
        this.$leaveProtectedSessionButton.on('click', protectedSessionService.leaveProtectedSession);

        return this.$widget;
    }

    protectedSessionStartedEvent() {
        this.$enterProtectedSessionButton.hide();
        this.$leaveProtectedSessionButton.show();
    }
}
