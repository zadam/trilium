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

    remove() {
        if (this.$widget) {
            this.$widget.remove();
        }
    }

    cleanup() {}
}

export default BasicWidget;