import Component from "./component.js";
import appContext from "./app_context.js";

export default class MobileScreenSwitcherExecutor extends Component {
    setActiveScreenCommand({screen}) {
        if (screen !== this.activeScreen) {
            this.activeScreen = screen;

            if (screen === 'tree') {
                const activeNoteContext = appContext.tabManager.getActiveContext();

                activeNoteContext.setEmpty();
            }

            this.triggerEvent('activeScreenChanged', {activeScreen: screen});
        }
    }
}
