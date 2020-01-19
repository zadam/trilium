import Component from "./component.js";

class BasicWidget extends Component {
    renderTo($parent) {
        this.$parent = $parent;

        $parent.append(this.render());
    }

    render() {
        return this.doRender();
    }

    /**
     * for overriding
     */
    doRender() {}

    toggle(show) {
        this.$widget.toggle(show);
    }

    cleanup() {}
}

export default BasicWidget;