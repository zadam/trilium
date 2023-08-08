import CalendarWidget from "../buttons/calendar.js";
import SpacerWidget from "../spacer.js";
import BookmarkButtons from "../bookmark_buttons.js";
import ProtectedSessionStatusWidget from "../buttons/protected_session_status.js";
import SyncStatusWidget from "../sync_status.js";
import BasicWidget from "../basic_widget.js";
import NoteLauncher from "../buttons/launcher/note_launcher.js";
import ScriptLauncher from "../buttons/launcher/script_launcher.js";
import CommandButtonWidget from "../buttons/command_button.js";
import utils from "../../services/utils.js";
import TodayLauncher from "../buttons/launcher/today_launcher.js";
import HistoryNavigationButton from "../buttons/history_navigation.js";

export default class LauncherWidget extends BasicWidget {
    constructor() {
        super();

        this.innerWidget = null;
    }

    isEnabled() {
        return this.innerWidget.isEnabled();
    }

    doRender() {
        this.$widget = this.innerWidget.render();
    }

    async initLauncher(note) {
        if (note.type !== 'launcher') {
            throw new Error(`Note '${note.noteId}' '${note.title}' is not a launcher even though it's in the launcher subtree`);
        }

        if (!utils.isDesktop() && note.isLabelTruthy('desktopOnly')) {
            return false;
        }

        const launcherType = note.getLabelValue("launcherType");

        if (glob.TRILIUM_SAFE_MODE && launcherType === 'customWidget') {
            return false;
        }

        if (launcherType === 'command') {
            this.innerWidget = this.initCommandLauncherWidget(note)
                .class("launcher-button");
        } else if (launcherType === 'note') {
            this.innerWidget = new NoteLauncher(note)
                .class("launcher-button");
        } else if (launcherType === 'script') {
            this.innerWidget = new ScriptLauncher(note)
                .class("launcher-button");
        } else if (launcherType === 'customWidget') {
            this.innerWidget = await this.initCustomWidget(note);
        } else if (launcherType === 'builtinWidget') {
            this.innerWidget = this.initBuiltinWidget(note);
        } else {
            throw new Error(`Unrecognized launcher type '${launcherType}' for launcher '${note.noteId}' title '${note.title}'`);
        }

        if (!this.innerWidget) {
            throw new Error(`Unknown initialization error for note '${note.noteId}', title '${note.title}'`);
        }

        this.child(this.innerWidget);

        return true;
    }

    initCommandLauncherWidget(note) {
        return new CommandButtonWidget()
            .title(() => note.title)
            .icon(() => note.getIcon())
            .command(() => note.getLabelValue("command"));
    }

    async initCustomWidget(note) {
        const widget = await note.getRelationTarget('widget');

        if (widget) {
            return await widget.executeScript();
        } else {
            throw new Error(`Custom widget of launcher '${note.noteId}' '${note.title}' is not defined.`);
        }
    }

    initBuiltinWidget(note) {
        const builtinWidget = note.getLabelValue("builtinWidget");

        if (builtinWidget === 'calendar') {
            return new CalendarWidget(note.title, note.getIcon());
        } else if (builtinWidget === 'spacer') {
            // || has to be inside since 0 is a valid value
            const baseSize = parseInt(note.getLabelValue("baseSize") || "40");
            const growthFactor = parseInt(note.getLabelValue("growthFactor") || "100");

            return new SpacerWidget(baseSize, growthFactor);
        } else if (builtinWidget === 'bookmarks') {
            return new BookmarkButtons();
        } else if (builtinWidget === 'protectedSession') {
            return new ProtectedSessionStatusWidget();
        } else if (builtinWidget === 'syncStatus') {
            return new SyncStatusWidget();
        } else if (builtinWidget === 'backInHistoryButton') {
            return new HistoryNavigationButton(note, "backInNoteHistory");
        } else if (builtinWidget === 'forwardInHistoryButton') {
            return new HistoryNavigationButton(note, "forwardInNoteHistory");
        } else if (builtinWidget === 'todayInJournal') {
            return new TodayLauncher(note);
        } else {
            throw new Error(`Unrecognized builtin widget ${builtinWidget} for launcher ${note.noteId} "${note.title}"`);
        }
    }
}
