import NoteContextAwareWidget from "../note_context_aware_widget.js";
import Container from "./container.js";

export default class ConditionalFlexContainer extends NoteContextAwareWidget {
    constructor(direction, condition) {
        super();
        this.$condition = condition;
        if (!direction || !['row', 'column'].includes(direction)) {
            throw new Error(`Direction argument given as '${direction}', use either 'row' or 'column'`);
        }

        this.attrs.style = `display: flex; flex-direction: ${direction};`;
    }

    doRender() {
        this.$widget = $(`<div>`);
        this.renderChildren();
    }

    renderChildren() {
        for (const widget of this.children) {
            this.$widget.append(widget.render());
        }
    }

    isEnabled() {
        return super.isEnabled()
            // main note context should not be closeable
            && this.$condition && this.$condition(this.noteContext);
    }
}
