import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-loading note-detail-printable">
    <h1>Note is loading...</h1>
</div>`;


export default class LoadingTypeWidget extends TypeWidget {
    static getType() { return "loading"; }

    doRender() {
        this.$widget = $(TPL);

        super.doRender();
    }
}
