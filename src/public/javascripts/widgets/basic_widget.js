import Component from "./component.js";

class BasicWidget extends Component {
    render() {
        return this.doRender();
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

    cleanup() {}
}

export default BasicWidget;