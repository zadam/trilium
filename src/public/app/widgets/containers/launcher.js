import ButtonWidget from "../buttons/button_widget.js";
import dialogService from "../../services/dialog.js";
import appContext from "../../components/app_context.js";
import CalendarWidget from "../buttons/calendar.js";
import SpacerWidget from "../spacer.js";
import BookmarkButtons from "../bookmark_buttons.js";
import ProtectedSessionStatusWidget from "../buttons/protected_session_status.js";
import SyncStatusWidget from "../sync_status.js";
import BackInHistoryButtonWidget from "../buttons/history/history_back.js";
import ForwardInHistoryButtonWidget from "../buttons/history/history_forward.js";
import BasicWidget from "../basic_widget.js";
import shortcutService from "../../services/shortcuts.js";

export default class LauncherWidget extends BasicWidget {
    constructor(launcherNote) {
        super();

        if (launcherNote.type !== 'launcher') {
            throw new Error(`Note '${this.note.noteId}' '${this.note.title}' is not a launcher even though it's in the launcher subtree`);
        }

        this.note = launcherNote;
        this.innerWidget = null;
        this.handler = null;
    }

    isEnabled() {
        return this.innerWidget.isEnabled();
    }

    doRender() {
        this.$widget = this.innerWidget.render();
    }

    async initLauncher() {
        const launcherType = this.note.getLabelValue("launcherType");

        if (launcherType === 'command') {
            this.handler = () => this.triggerCommand(this.note.getLabelValue("command"));

            this.innerWidget = new ButtonWidget()
                .title(this.note.title)
                .icon(this.note.getIcon())
                .onClick(this.handler);
        } else if (launcherType === 'note') {
            // we're intentionally displaying the launcher title and icon instead of the target
            // e.g. you want to make launchers to 2 mermaid diagrams which both have mermaid icon (ok),
            // but on the launchpad you want them distinguishable.
            // for titles, the note titles may follow a different scheme than maybe desirable on the launchpad
            // another reason is the discrepancy between what user sees on the launchpad and in the config (esp. icons).
            // The only (but major) downside is more work in setting up the typical case where you actually want to have both title and icon in sync.

            this.handler = () => {
                const targetNoteId = this.note.getRelationValue('targetNote');

                if (!targetNoteId) {
                    dialogService.info("This launcher doesn't define target note.");
                    return;
                }

                appContext.tabManager.openTabWithNoteWithHoisting(targetNoteId, true)
            };

            this.innerWidget = new ButtonWidget()
                .title(this.note.title)
                .icon(this.note.getIcon())
                .onClick(this.handler);
        } else if (launcherType === 'script') {
            this.handler = async () => {
                const script = await this.note.getRelationTarget('script');

                await script.executeScript();
            };

            this.innerWidget = new ButtonWidget()
                .title(this.note.title)
                .icon(this.note.getIcon())
                .onClick(this.handler);
        } else if (launcherType === 'customWidget') {
            const widget = await this.note.getRelationTarget('widget');

            if (widget) {
                this.innerWidget = await widget.executeScript();
            } else {
                throw new Error(`Could not initiate custom widget of launcher '${this.note.noteId}' '${this.note.title}`);
            }
        } else if (launcherType === 'builtinWidget') {
            const builtinWidget = this.note.getLabelValue("builtinWidget");

            if (builtinWidget) {
                if (builtinWidget === 'calendar') {
                    this.innerWidget = new CalendarWidget(this.note.title, this.note.getIcon());
                } else if (builtinWidget === 'spacer') {
                    // || has to be inside since 0 is a valid value
                    const baseSize = parseInt(this.note.getLabelValue("baseSize") || "40");
                    const growthFactor = parseInt(this.note.getLabelValue("growthFactor") || "100");

                    this.innerWidget = new SpacerWidget(baseSize, growthFactor);
                } else if (builtinWidget === 'bookmarks') {
                    this.innerWidget = new BookmarkButtons();
                } else if (builtinWidget === 'protectedSession') {
                    this.innerWidget = new ProtectedSessionStatusWidget();
                } else if (builtinWidget === 'syncStatus') {
                    this.innerWidget = new SyncStatusWidget();
                } else if (builtinWidget === 'backInHistoryButton') {
                    this.innerWidget = new BackInHistoryButtonWidget();
                } else if (builtinWidget === 'forwardInHistoryButton') {
                    this.innerWidget = new ForwardInHistoryButtonWidget();
                } else {
                    throw new Error(`Unrecognized builtin widget ${builtinWidget} for launcher ${this.note.noteId} "${this.note.title}"`);
                }
            }
        } else {
            throw new Error(`Unrecognized launcher type '${launcherType}' for launcher '${this.note.noteId}' title ${this.note.title}`);
        }

        if (!this.innerWidget) {
            throw new Error(`Unknown initialization error for note '${this.note.noteId}', title '${this.note.title}'`);
        }

        for (const label of this.note.getLabels('keyboardShortcut')) {
            this.bindNoteShortcutHandler(label);
        }

        this.child(this.innerWidget);
    }

    bindNoteShortcutHandler(label) {
        if (!this.handler) {
            return;
        }

        const namespace = label.attributeId;

        if (label.isDeleted) {
            shortcutService.removeGlobalShortcut(namespace);
        } else {
            shortcutService.bindGlobalShortcut(label.value, this.handler, namespace);
        }
    }

    entitiesReloadedEvent({loadResults}) {
        for (const attr of loadResults.getAttributes()) {
            if (attr.noteId === this.note.noteId && attr.type === 'label' && attr.name === 'keyboardShortcut') {
                this.bindNoteShortcutHandler(attr);
            }
        }
    }
}
