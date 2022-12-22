import AbstractLauncher from "./abstract_launcher.js";
import dialogService from "../../../services/dialog.js";
import appContext from "../../../components/app_context.js";
import utils from "../../../services/utils.js";
import linkContextMenuService from "../../../menus/link_context_menu.js";

// we're intentionally displaying the launcher title and icon instead of the target
// e.g. you want to make launchers to 2 mermaid diagrams which both have mermaid icon (ok),
// but on the launchpad you want them distinguishable.
// for titles, the note titles may follow a different scheme than maybe desirable on the launchpad
// another reason is the discrepancy between what user sees on the launchpad and in the config (esp. icons).
// The only downside is more work in setting up the typical case
// where you actually want to have both title and icon in sync, but for those cases there are bookmarks
export default class NoteLauncher extends AbstractLauncher {
    constructor(launcherNote) {
        super(launcherNote);

        this.title(() => this.launcherNote.title)
            .icon(() => this.launcherNote.getIcon())
            .onClick((widget, evt) => this.launch(evt))
            .onAuxClick((widget, evt) => this.launch(evt))
            .onContextMenu(evt => {
                const targetNoteId = this.getTargetNoteId();
                if (!targetNoteId) {
                    return;
                }

                const hoistedNoteId = this.getHoistedNoteId();

                linkContextMenuService.openContextMenu(targetNoteId, hoistedNoteId, evt);
            });
    }

    async launch(evt) {
        // await because subclass overrides can be async
        const targetNoteId = await this.getTargetNoteId();
        if (!targetNoteId) {
            return;
        }

        const hoistedNoteId = await this.getHoistedNoteId();

        if (!evt) {
            // keyboard shortcut
            await appContext.tabManager.openInSameTab(targetNoteId, hoistedNoteId);
        } else {
            const ctrlKey = utils.isCtrlKey(evt);

            if ((evt.which === 1 && ctrlKey) || evt.which === 2) {
                await appContext.tabManager.openInNewTab(targetNoteId, hoistedNoteId);
            } else {
                await appContext.tabManager.openInSameTab(targetNoteId, hoistedNoteId);
            }
        }
    }

    getTargetNoteId() {
        const targetNoteId = this.launcherNote.getRelationValue('target');

        if (!targetNoteId) {
            dialogService.info("This launcher doesn't define target note.");
            return;
        }

        return targetNoteId;
    }

    getHoistedNoteId() {
        return this.launcherNote.getRelationValue('hoistedNote')
            || appContext.tabManager.getActiveContext().hoistedNoteId;
    }

    getTitle() {
        const shortcuts = this.launcherNote.getLabels("keyboardShortcut")
            .map(l => l.value)
            .filter(v => !!v)
            .join(", ");

        let title = super.getTitle();
        if (shortcuts) {
            title += ` (${shortcuts})`;
        }

        return title;
    }
}
