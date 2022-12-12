import Component from "./component.js";

export default class MobileScreenSwitcherExecutor extends Component {
    setActiveScreenCommand({screen}) {
        if (screen !== this.activeScreen) {
            this.activeScreen = screen;

            if (screen === 'tree') {
                document.location.hash = '';
            }

            this.triggerEvent('activeScreenChanged', {activeScreen: screen});
        }
    }
}
