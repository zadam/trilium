const WIDGET_TPL = `
<div class="card widget">
    <div class="card-header">        
        <button class="btn btn-sm widget-title" data-toggle="collapse" data-target="#[to be set]">
            Collapsible Group Item
        </button>
        
        <div class="widget-header-actions"></div>
    </div>

    <div id="[to be set]" class="collapse body-wrapper">
        <div class="card-body"></div>
    </div>
</div>
`;

class StandardWidget {
    /**
     * @param {TabContext} ctx
     * @param {object} state
     * @param {string} widgetId
     */
    constructor(ctx, state, widgetId) {
        this.ctx = ctx;
        this.widgetId = widgetId;

        this.$widget = $(WIDGET_TPL);
        this.$widget.find('[data-target]').attr('data-target', "#widget-" + widgetId);

        this.$bodyWrapper = this.$widget.find('.body-wrapper');
        this.$bodyWrapper.attr('id', "widget-" + widgetId);

        if (state && state.visible) {
            this.$bodyWrapper.addClass("show");
        }

        this.$body = this.$bodyWrapper.find('.card-body');

        this.$widget.on('shown.bs.collapse', () => this.renderBody());
        this.$widget.on('shown.bs.collapse', () => this.ctx.stateChanged());
        this.$widget.on('hidden.bs.collapse', () => this.ctx.stateChanged());
        this.$title = this.$widget.find('.widget-title');
        this.$headerActions = this.$widget.find('.widget-header-actions');
    }

    async renderBody() {
        if (!this.isVisible() || this.rendered) {
            return;
        }

        this.rendered = true;

        await this.doRenderBody();
    }

    /** for overriding */
    async doRenderBody() {}

    isVisible() {
        return this.$bodyWrapper.is(":visible");
    }

    getWidgetState() {
        return {
            id: this.widgetId,
            visible: this.isVisible()
        };
    }

    getWidgetElement() {
        return this.$widget;
    }

    syncDataReceived(syncData) {}
}

export default StandardWidget;