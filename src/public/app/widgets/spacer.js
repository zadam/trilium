import BasicWidget from "./basic_widget.js";

const TPL = `<div class="spacer"></div>`;

export default class SpacerWidget extends BasicWidget {
    constructor(baseSize = 0, growIndex = 1000, shrinkIndex = 1000) {
        super();

        this.baseSize = baseSize;
        this.growIndex = growIndex;
        this.shrinkIndex = shrinkIndex;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$widget.css("flex-basis", this.baseSize);
        this.$widget.css("flex-grow", this.growIndex);
        this.$widget.css("flex-shrink", this.shrinkIndex);
    }
}
