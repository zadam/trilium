import BasicWidget from "./basic_widget.js";

const TPL = `<div class="spacer"></div>`;

export default class SpacerWidget extends BasicWidget {
    constructor(growIndex = 1000) {
        super();

        this.growIndex = growIndex;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$widget.css("flex-grow", this.growIndex)
    }
}
