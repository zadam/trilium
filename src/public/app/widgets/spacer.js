import BasicWidget from "./basic_widget.js";

const TPL = `<div class="spacer"></div>`;

export default class SpacerWidget extends BasicWidget {
    constructor(baseSize = 0, growthFactor = 1000) {
        super();

        this.baseSize = baseSize;
        this.growthFactor = growthFactor;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$widget.css("flex-basis", this.baseSize);
        this.$widget.css("flex-grow", this.growthFactor);
        this.$widget.css("flex-shrink", 1000);
    }
}
