import BasicWidget from "../basic_widget.js";

const TPL = `
<button type="button" class="action-button d-sm-none d-md-none d-lg-none d-xl-none" aria-label="Close">
    <span aria-hidden="true">&times;</span>
</button>`;

class CloseDetailButtonWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$widget.on('click', () => this.triggerCommand('setActiveScreen', {screen:'tree'}));

        return this.$widget;
    }
}

export default CloseDetailButtonWidget;