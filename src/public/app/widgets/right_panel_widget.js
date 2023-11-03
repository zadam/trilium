import NoteContextAwareWidget from "./note_context_aware_widget.js";

const WIDGET_TPL = `
<div class="card widget">
    <div class="card-header">
        <div class="card-header-title"></div>
        <div class="card-header-buttons"></div>
    </div>

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

    get widgetButtons() { return []; }

    get help() { return {}; }

    constructor() {
        super();

        this.child(...this.widgetButtons);
    }

    /**
     * Do not override this method unless you know what you're doing.
     * Do not override this method unless you know what you're doing.
     */
    doRender() {
        this.$widget = $(WIDGET_TPL);
        this.contentSized();
        this.$widget.find('[data-target]').attr('data-target', `#${this.componentId}`);

        this.$bodyWrapper = this.$widget.find('.body-wrapper');
        this.$bodyWrapper.attr('id', this.componentId); // for toggle to work we need id

        this.$body = this.$bodyWrapper.find('.card-body');

        this.$title = this.$widget.find('.card-header .card-header-title');
        this.$title.text(this.widgetTitle);

        this.$buttons = this.$widget.find('.card-header .card-header-buttons');
        this.$buttons.empty();

        for (const buttonWidget of this.children) {
            this.$buttons.append(buttonWidget.render());
        }

        this.initialized = this.doRenderBody();
    }

    /**
     * Method used for rendering the body of the widget (via existing this.$body)
     *
     * Your class should override this method.
     * @returns {Promise|undefined} if widget needs async operation to initialize, it can return a Promise
     */
    async doRenderBody() {}
}

export default RightPanelWidget;
