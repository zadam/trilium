import FlexContainer from "./flex_container.js";
import froca from "../../services/froca.js";
import ButtonWidget from "../buttons/button_widget.js";
import CalendarWidget from "../buttons/calendar.js";
import appContext from "../../services/app_context.js";
import SpacerWidget from "../spacer.js";
import BookmarkButtons from "../bookmark_buttons.js";
import ProtectedSessionStatusWidget from "../buttons/protected_session_status.js";
import SyncStatusWidget from "../sync_status.js";

export default class ShortcutContainer extends FlexContainer {
    constructor() {
        super('column');

        this.id('shortcut-container');
        this.css('height', '100%');
        this.filling();

        this.load();
    }

    async load() {
        this.children = [];

        const visibleShortcutsRoot = await froca.getNote('lb_visibleshortcuts', true);

        if (!visibleShortcutsRoot) {
            console.log("Visible shortcuts root note doesn't exist.");

            return;
        }

        for (const shortcut of await visibleShortcutsRoot.getChildNotes()) {
            if (shortcut.getLabelValue("command")) {
                this.child(new ButtonWidget()
                    .title(shortcut.title)
                    .icon(shortcut.getIcon())
                    .command(shortcut.getLabelValue("command")));
            } else if (shortcut.hasRelation('targetNote')) {
                this.child(new ButtonWidget()
                    .title(shortcut.title)
                    .icon(shortcut.getIcon())
                    .onClick(() => appContext.tabManager.openTabWithNoteWithHoisting(shortcut.getRelationValue('targetNote'), true)));
            } else {
                const builtinWidget = shortcut.getLabelValue("builtinWidget");

                if (builtinWidget) {
                    if (builtinWidget === 'calendar') {
                        this.child(new CalendarWidget(shortcut.title, shortcut.getIcon()));
                    } else if (builtinWidget === 'spacer') {
                        // || has to be inside since 0 is a valid value
                        const baseSize = parseInt(shortcut.getLabelValue("baseSize") || "40");
                        const growthFactor = parseInt(shortcut.getLabelValue("growthFactor") || "100");

                        this.child(new SpacerWidget(baseSize, growthFactor));
                    } else if (builtinWidget === 'pluginButtons') {
                        this.child(new FlexContainer("column")
                            .id("plugin-buttons")
                            .contentSized());
                    } else if (builtinWidget === 'bookmarks') {
                        this.child(new BookmarkButtons());
                    } else if (builtinWidget === 'protectedSession') {
                        this.child(new ProtectedSessionStatusWidget());
                    } else if (builtinWidget === 'syncStatus') {
                        this.child(new SyncStatusWidget());
                    } else {
                        console.log(`Unrecognized builtin widget ${builtinWidget} for shortcut ${shortcut.noteId} "${shortcut.title}"`);
                    }
                }
            }
        }

        this.$widget.empty();
        this.renderChildren();

        this.handleEventInChildren('initialRenderComplete');
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getNoteIds().find(noteId => froca.notes[noteId]?.isLaunchBarConfig())
            || loadResults.getBranches().find(branch => branch.parentNoteId.startsWith("lb_"))
            || loadResults.getAttributes().find(attr => froca.notes[attr.noteId]?.isLaunchBarConfig())) {
            this.load();
        }
    }
}
