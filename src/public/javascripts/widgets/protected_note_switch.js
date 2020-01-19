import BasicWidget from "./basic_widget.js";

const TPL = `
<div class="btn-group btn-group-xs">
    <button type="button"
            class="btn btn-sm icon-button bx bx-check-shield protect-button"
            title="Protected note can be viewed and edited only after entering password">
    </button>

    <button type="button"
            class="btn btn-sm icon-button bx bx-shield unprotect-button"
            title="Not protected note can be viewed without entering password">
    </button>
</div>`;

export default class ProtectedNoteSwitchWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);

        return this.$widget;
    }
}