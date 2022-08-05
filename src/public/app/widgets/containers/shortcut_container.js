import FlexContainer from "./flex_container.js";
import froca from "../../services/froca.js";
import ButtonWidget from "../buttons/button_widget.js";
import CalendarWidget from "../buttons/calendar.js";
import appContext from "../../services/app_context.js";

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

        const visibleShortcutsRoot = await froca.getNote('lb_visibleshortcuts');

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
        if (loadResults.getNoteIds().find(noteId => noteId.startsWith("lb_"))
            || loadResults.getBranches().find(branch => branch.branchId.startsWith("lb_"))
            || loadResults.getAttributes().find(attr => attr.noteId.startsWith("lb_"))) {
            this.load();
        }
    }
}
