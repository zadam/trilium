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
        await froca.initializedPromise;

        this.children = [];

        const visibleLaunchersRoot = await froca.getNote('_lbVisibleLaunchers', true);

        if (!visibleLaunchersRoot) {
            console.log("Visible launchers root note doesn't exist.");

            return;
        }

        await Promise.allSettled(
            (await visibleLaunchersRoot.getChildNotes())
                .map(async launcherNote => {
                    try {
                        const launcherWidget = new LauncherWidget();
                        const success = await launcherWidget.initLauncher(launcherNote);

                        if (success) {
                            this.child(launcherWidget);
                        }
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
        if (loadResults.getBranches().find(branch => froca.getNoteFromCache(branch.parentNoteId)?.isLaunchBarConfig())) {
            // changes in note placement requires reload of all launchers, all other changes are handled by individual
            // launchers
            this.load();
        }
    }
}
