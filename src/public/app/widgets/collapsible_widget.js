import TabAwareWidget from "./tab_aware_widget.js";
import options from "../services/options.js";

const WIDGET_TPL = `
<div class="card widget">
    <div class="card-header">
        <div>           
            <span class="widget-title">
                Collapsible Group Item
            </span>
        
            <span class="widget-header-actions"></span>
        </div>
        
        <div>
            <a class="widget-help external no-arrow bx bx-info-circle"></a>
            &nbsp;
            <a class="widget-toggle-button no-arrow bx bx-minus" 
                title="Minimize/maximize widget"
                data-toggle="collapse" data-target="#[to be set]"></a>
        </div>
    </div>

    <div id="[to be set]" class="collapse body-wrapper" style="transition: none; ">
        <div class="card-body"></div>
    </div>
</div>`;

export default class CollapsibleWidget extends TabAwareWidget {
    get widgetTitle() { return "Untitled widget"; }

    get headerActions() { return []; }

    get help() { return {}; }

    doRender() {
        this.$widget = $(WIDGET_TPL);
        this.contentSized();
        this.$widget.find('[data-target]').attr('data-target', "#" + this.componentId);

        this.$bodyWrapper = this.$widget.find('.body-wrapper');
        this.$bodyWrapper.attr('id', this.componentId); // for toggle to work we need id

        // not using constructor name because of webpack mangling class names ...
        this.widgetName = this.widgetTitle.replace(/[^[a-zA-Z0-9]/g, "_");

        this.$toggleButton = this.$widget.find('.widget-toggle-button');

        const collapsed = options.is(this.widgetName + 'Collapsed');
        if (!collapsed) {
            this.$bodyWrapper.collapse("show");
        }

        this.updateToggleButton(collapsed);

        // using immediate variants of the event so that the previous collapse is not caught
        this.$bodyWrapper.on('hide.bs.collapse', () => this.toggleCollapsed(true));
        this.$bodyWrapper.on('show.bs.collapse', () => this.toggleCollapsed(false));

        this.$body = this.$bodyWrapper.find('.card-body');

        this.$title = this.$widget.find('.widget-title');
        this.$title.text(this.widgetTitle);

        this.$help = this.$widget.find('.widget-help');

        if (this.help.title) {
            this.$help.attr("title", this.help.title);
            this.$help.attr("href", this.help.url || "javascript:");

            if (!this.help.url) {
                this.$help.addClass('no-link');
            }
        }
        else {
            this.$help.hide();
        }

        this.$headerActions = this.$widget.find('.widget-header-actions');
        this.$headerActions.append(this.headerActions);

        this.initialized = this.doRenderBody();

        this.decorateWidget();
    }

    toggleCollapsed(collapse) {
        this.updateToggleButton(collapse);

        options.save(this.widgetName + 'Collapsed', collapse.toString());

        this.triggerEvent(`widgetCollapsedStateChanged`, {widgetName: this.widgetName, collapse});
    }

    updateToggleButton(collapse) {
        if (collapse) {
            this.$toggleButton
                .addClass("bx-window")
                .removeClass("bx-minus")
                .attr("title", "Show");
        } else {
            this.$toggleButton
                .addClass("bx-minus")
                .removeClass("bx-window")
                .attr("title", "Hide");
        }
    }

    /**
     * This event is used to synchronize collapsed state of all the tab-cached widgets since they are all rendered
     * separately but should behave uniformly for the user.
     */
    widgetCollapsedStateChangedEvent({widgetName, collapse}) {
        if (widgetName === this.widgetName) {
            this.$bodyWrapper.toggleClass('show', !collapse);
        }
    }

    /** for overriding */
    decorateWidget() {}

    /** for overriding */
    async doRenderBody() {}

    isExpanded() {
        return this.$bodyWrapper.hasClass("show");
    }
}
