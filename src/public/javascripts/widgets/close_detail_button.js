import BasicWidget from "./basic_widget.js";

const TPL = `
<button type="button" class="close-detail-button action-button d-sm-none d-md-none d-lg-none d-xl-none" aria-label="Close">
    <span aria-hidden="true">&times;</span>
</button>`;

class CloseDetailButtonWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);

        //this.$widget.find('.close-detail-button').on('click', );

        return this.$widget;
    }
}

export default CloseDetailButtonWidget;