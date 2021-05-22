import Container from "./container.js";

export default class ScrollingContainer extends Container {
    constructor() {
        super();

        this.css('height: 100%; overflow: auto;');
    }

    async tabNoteSwitchedEvent({noteContext, notePath}) {
        // if notePath does not match then the noteContext has been switched to another note in the mean time
        if (noteContext.notePath === notePath) {
            this.$widget.scrollTop(0);
        }
    }
}
