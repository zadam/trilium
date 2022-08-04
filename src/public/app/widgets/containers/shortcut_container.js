import FlexContainer from "./flex_container.js";
import froca from "../../services/froca.js";
import ButtonWidget from "../buttons/button_widget.js";

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

        console.log(await visibleShortcutsRoot.getChildNotes());

        for (const shortcut of await visibleShortcutsRoot.getChildNotes()) {
            this.child(new ButtonWidget()
                .icon(shortcut.getLabelValue("iconClass"))
                .title(shortcut.title)
                .command(shortcut.getLabelValue("command")));
        }

        this.$widget.empty();
        this.renderChildren();

        this.handleEventInChildren('initialRenderComplete');
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getNotes().find(note => note.noteId.startsWith("lb_"))
            || loadResults.getBranches().find(branch => branch.branchId.startsWith("lb_"))) {
            this.load();
        }
    }
}
