import TabAwareWidget from "./tab_aware_widget.js";

const WIDGET_TPL = `
<div class="card widget">
    <div class="card-header">
        <div>           
            <button class="btn btn-sm widget-title" data-toggle="collapse" data-target="#[to be set]">
                Collapsible Group Item
            </button>
            
            <a class="widget-help external no-arrow bx bx-info-circle"></a>
        </div>
        
        <div class="widget-header-actions"></div>
    </div>

    <div id="[to be set]" class="collapse body-wrapper" style="transition: none;">
        <div class="card-body"></div>
    </div>
</div>
`;

export default class CollapsibleWidget extends TabAwareWidget {
    getWidgetTitle() { return "Untitled widget"; }

    getHeaderActions() { return []; }

    getHelp() { return {}; }

    getMaxHeight() { return null; }

    doRender() {
        this.$widget = $(WIDGET_TPL);
        this.$widget.find('[data-target]').attr('data-target', "#" + this.componentId);

        this.$bodyWrapper = this.$widget.find('.body-wrapper');
        this.$bodyWrapper.attr('id', this.componentId);

        this.$bodyWrapper.collapse("show");

        this.$body = this.$bodyWrapper.find('.card-body');

        const maxHeight = this.getMaxHeight();

        if (maxHeight) {
            this.$body.css("max-height", maxHeight);
            this.$body.css("overflow", "auto");
        }

        this.$title = this.$widget.find('.widget-title');
        this.$title.text(this.getWidgetTitle());

        this.$help = this.$widget.find('.widget-help');
        const help = this.getHelp();

        if (help.title) {
            this.$help.attr("title", help.title);
            this.$help.attr("href", help.url || "javascript:");

            if (!help.url) {
                this.$help.addClass('no-link');
            }
        }
        else {
            this.$help.hide();
        }

        this.$headerActions = this.$widget.find('.widget-header-actions');
        this.$headerActions.append(...this.getHeaderActions());

        this.initialized = this.doRenderBody();

        return this.$widget;
    }

    /** for overriding */
    async doRenderBody() {}

    isExpanded() {
        return this.$bodyWrapper.hasClass("show");
    }
}