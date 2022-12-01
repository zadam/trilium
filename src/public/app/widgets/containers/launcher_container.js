import FlexContainer from "./flex_container.js";
import froca from "../../services/froca.js";
import ButtonWidget from "../buttons/button_widget.js";
import CalendarWidget from "../buttons/calendar.js";
import appContext from "../../components/app_context.js";
import SpacerWidget from "../spacer.js";
import BookmarkButtons from "../bookmark_buttons.js";
import ProtectedSessionStatusWidget from "../buttons/protected_session_status.js";
import SyncStatusWidget from "../sync_status.js";
import BackInHistoryButtonWidget from "../buttons/history/history_back.js";
import ForwardInHistoryButtonWidget from "../buttons/history/history_forward.js";
import dialogService from "../../services/dialog.js";

export default class LauncherContainer extends FlexContainer {
    constructor() {
        super('column');

        this.id('launcher-container');
        this.css('height', '100%');
        this.filling();

        this.load();
    }

    async load() {
        this.children = [];

        const visibleLaunchersRoot = await froca.getNote('lb_visiblelaunchers', true);

        if (!visibleLaunchersRoot) {
            console.log("Visible launchers root note doesn't exist.");

            return;
        }

        await Promise.allSettled(
            (await visibleLaunchersRoot.getChildNotes())
                .map(launcher => this.initLauncher(launcher))
        );

        this.$widget.empty();
        this.renderChildren();

        await this.handleEventInChildren('initialRenderComplete');

        const activeContext = appContext.tabManager.getActiveContext();

        if (activeContext) {
            await this.handleEvent('setNoteContext', {
                noteContext: activeContext
            });

            if (activeContext.notePath) {
                await this.handleEvent('noteSwitched', {
                    noteContext: activeContext,
                    notePath: activeContext.notePath
                });
            }
        }
    }

    async initLauncher(launcher) {
        try {
            if (launcher.type !== 'launcher') {
                console.warn(`Note ${launcher.noteId} is not a launcher even though it's in launcher subtree`);
                return;
            }

            const launcherType = launcher.getLabelValue("launcherType");

            if (launcherType === 'command') {
                this.child(new ButtonWidget()
                    .title(launcher.title)
                    .icon(launcher.getIcon())
                    .command(launcher.getLabelValue("command")));
            } else if (launcherType === 'note') {
                // we're intentionally displaying the launcher title and icon instead of the target
                // e.g. you want to make launchers to 2 mermaid diagrams which both have mermaid icon (ok),
                // but on the launchpad you want them distinguishable.
                // for titles, the note titles may follow a different scheme than maybe desirable on the launchpad
                // another reason is the discrepancy between what user sees on the launchpad and in the config (esp. icons).
                // The only (but major) downside is more work in setting up the typical case where you actually want to have both title and icon in sync.

                this.child(new ButtonWidget()
                    .title(launcher.title)
                    .icon(launcher.getIcon())
                    .onClick(() => {
                        const targetNoteId = launcher.getRelationValue('targetNote');

                        if (!targetNoteId) {
                            dialogService.info("This launcher doesn't define target note.");
                            return;
                        }

                        appContext.tabManager.openTabWithNoteWithHoisting(targetNoteId, true)
                    }));
            } else if (launcherType === 'script') {
                this.child(new ButtonWidget()
                    .title(launcher.title)
                    .icon(launcher.getIcon())
                    .onClick(async () => {
                        const script = await launcher.getRelationTarget('script');

                        await script.executeScript();
                    }));
            } else if (launcherType === 'customWidget') {
                const widget = await launcher.getRelationTarget('widget');

                if (widget) {
                    const res = await widget.executeScript();

                    this.child(res);
                }
            } else if (launcherType === 'builtinWidget') {
                const builtinWidget = launcher.getLabelValue("builtinWidget");

                if (builtinWidget) {
                    if (builtinWidget === 'calendar') {
                        this.child(new CalendarWidget(launcher.title, launcher.getIcon()));
                    } else if (builtinWidget === 'spacer') {
                        // || has to be inside since 0 is a valid value
                        const baseSize = parseInt(launcher.getLabelValue("baseSize") || "40");
                        const growthFactor = parseInt(launcher.getLabelValue("growthFactor") || "100");

                        this.child(new SpacerWidget(baseSize, growthFactor));
                    } else if (builtinWidget === 'bookmarks') {
                        this.child(new BookmarkButtons());
                    } else if (builtinWidget === 'protectedSession') {
                        this.child(new ProtectedSessionStatusWidget());
                    } else if (builtinWidget === 'syncStatus') {
                        this.child(new SyncStatusWidget());
                    } else if (builtinWidget === 'backInHistoryButton') {
                        this.child(new BackInHistoryButtonWidget());
                    } else if (builtinWidget === 'forwardInHistoryButton') {
                        this.child(new ForwardInHistoryButtonWidget());
                    } else {
                        console.warn(`Unrecognized builtin widget ${builtinWidget} for launcher ${launcher.noteId} "${launcher.title}"`);
                    }
                }
            } else {
                console.warn(`Unrecognized launcher type ${launcherType} for launcher '${launcher.noteId}' title ${launcher.title}`);
            }
        }
        catch (e) {
            console.error(`Initialization of launcher '${launcher.noteId}' with title '${launcher.title}' failed with error: ${e.message} ${e.stack}`);
        }
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getNoteIds().find(noteId => froca.notes[noteId]?.isLaunchBarConfig())
            || loadResults.getBranches().find(branch => branch.parentNoteId.startsWith("lb_"))
            || loadResults.getAttributes().find(attr => froca.notes[attr.noteId]?.isLaunchBarConfig())) {
            this.load();
        }
    }
}
