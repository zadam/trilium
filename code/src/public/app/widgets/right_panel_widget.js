import NoteContextAwareWidget from "./note_context_aware_widget.js";

const WIDGET_TPL = `
<div class="card widget">
    <div class="card-header"></div>

    <div id="[to be set]" class="body-wrapper">
        <div class="card-body"></div>
    </div>
</div>`;

export default class RightPanelWidget extends NoteContextAwareWidget {
    get widgetTitle() { return "Untitled widget"; }

    get help() { return {}; }

    doRender() {
        this.$widget = $(WIDGET_TPL);
        this.contentSized();
        this.$widget.find('[data-target]').attr('data-target', `#${this.componentId}`);

        this.$bodyWrapper = this.$widget.find('.body-wrapper');
        this.$bodyWrapper.attr('id', this.componentId); // for toggle to work we need id

        this.$body = this.$bodyWrapper.find('.card-body');

        this.$title = this.$widget.find('.card-header');
        this.$title.text(this.widgetTitle);

        this.initialized = this.doRenderBody();
    }

    /* for overriding */
    async doRenderBody() {}
}
