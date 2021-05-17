import BasicWidget from "./basic_widget.js";

const TPL = `
<div class="spacer">
    <style>
    .spacer {
        flex-grow: 1000;
    }
    </style>
</div>
`;

export default class SpacerWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
    }
}
