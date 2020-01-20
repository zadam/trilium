import Component from "./component.js";
import keyboardActionsService from "../services/keyboard_actions.js";

class BasicWidget extends Component {
    render() {
        const $widget = this.doRender();

        keyboardActionsService.updateDisplayedShortcuts($widget);

        return $widget;
    }

    /**
     * for overriding
     */
    doRender() {}

    toggle(show) {
        if (!this.$widget) {
            console.log(this.componentId);
        }

        this.$widget.toggle(show);
    }

    remove() {
        if (this.$widget) {
            this.$widget.remove();
        }
    }

    cleanup() {}
}

export default BasicWidget;