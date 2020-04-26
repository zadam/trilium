import Component from "../component.js";

export default class MobileScreenSwitcherExecutor extends Component {
    setActiveScreenCommand({screen}) {
        if (screen !== this.activeScreen) {
            this.activeScreen = screen;

            this.triggerEvent('activeScreenChanged', {activeScreen: screen});
        }
    }

    initialRenderCompleteEvent() {
        this.setActiveScreenCommand({screen: 'tree'});
    }
}