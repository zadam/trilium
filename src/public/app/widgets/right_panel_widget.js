import NoteContextAwareWidget from "./note_context_aware_widget.js";

const WIDGET_TPL = `
<div class="card widget">
    <div class="card-header"></div>

    <div id="[to be set]" class="body-wrapper">
        <div class="card-body"></div>
    </div>
</div>`;

/**
 * This widget manages rendering panels in the right-hand pane.
 * @extends {NoteContextAwareWidget}
 */
class RightPanelWidget extends NoteContextAwareWidget {
    /** Title to show in the panel. */
    get widgetTitle() { return "Untitled widget"; }

    get help() { return {}; }

    /**
     * Do not override this method unless you know what you're doing.
     */
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

    /**
     * Method used for rendering the body of the widget.
     * 
     * Your class should override this method.
     * @returns {JQuery<HTMLElement>} The body of your widget.
     */
    async doRenderBody() {}
}

export default RightPanelWidget;