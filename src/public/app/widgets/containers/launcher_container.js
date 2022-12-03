import FlexContainer from "./flex_container.js";
import froca from "../../services/froca.js";
import appContext from "../../components/app_context.js";
import LauncherWidget from "./launcher.js";

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
                .map(async launcherNote => {
                    try {
                        const launcherWidget = new LauncherWidget();
                        await launcherWidget.initLauncher(launcherNote);
                        this.child(launcherWidget);
                    }
                    catch (e) {
                        console.error(e);
                    }
                })
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

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getNoteIds().find(noteId => froca.notes[noteId]?.isLaunchBarConfig())
            || loadResults.getBranches().find(branch => branch.parentNoteId.startsWith("lb_"))
            || loadResults.getAttributes().find(attr => froca.notes[attr.noteId]?.isLaunchBarConfig())) {
            this.load();
        }
    }
}
