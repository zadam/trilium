import NoteInfoWidget from "../widgets/note_info.js";
import LinkMapWidget from "../widgets/link_map.js";
import NoteRevisionsWidget from "../widgets/note_revisions.js";
import AttributesWidget from "../widgets/attributes.js";

const WIDGET_TPL = `
<div class="card widget">
    <div class="card-header">        
        <button class="btn btn-sm widget-title" data-toggle="collapse" data-target="#collapseOne">
            Collapsible Group Item
        </button>
        
        <div class="widget-header-actions"></div>
    </div>

    <div id="collapseOne" class="collapse show body-wrapper">
        <div class="card-body"></div>
    </div>
</div>
`;

let widgetIdCtr = 1;

class Sidebar {
    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.widgets = [];
        this.$sidebar = ctx.$tabContent.find(".note-detail-sidebar");
        this.$widgets = this.$sidebar.find(".note-detail-widgets");
        this.$showSideBarButton = this.ctx.$tabContent.find(".show-sidebar-button");
        this.$showSideBarButton.hide();

        this.$hideSidebarButton = this.$sidebar.find(".hide-sidebar-button");

        this.$hideSidebarButton.click(() => {
            this.$sidebar.hide();
            this.$showSideBarButton.show();
            this.ctx.stateChanged();
        });

        this.$showSideBarButton.click(() => {
            this.$sidebar.show();
            this.$showSideBarButton.hide();
            this.ctx.stateChanged();
        });
    }

    isVisible() {
        return this.$sidebar.is(":visible");
    }

    getSidebarState() {
        return {
            visible: this.isVisible(),
            widgets: this.widgets.map(w => w.getWidgetState())
        }
    }

    async noteLoaded() {
        this.widgets = [];
        this.$widgets.empty();

        const widgetClasses = [AttributesWidget, LinkMapWidget, NoteRevisionsWidget, NoteInfoWidget];

        for (const widgetClass of widgetClasses) {
            const $widget = this.createWidgetElement();

            const attributesWidget = new widgetClass(this.ctx, $widget);
            this.widgets.push(attributesWidget);

            attributesWidget.renderBody(); // let it run in parallel

            this.$widgets.append($widget);
        }
    }

    createWidgetElement() {
        const widgetId = 'widget-' + widgetIdCtr++;

        const $widget = $(WIDGET_TPL);
        $widget.find('[data-target]').attr('data-target', "#" + widgetId);
        $widget.find('.body-wrapper').attr('id', widgetId);

        return $widget;
    }

    syncDataReceived(syncData) {
        for (const widget of this.widgets) {
            if (widget.syncDataReceived) {
                widget.syncDataReceived(syncData);
            }
        }
    }
}

export default Sidebar;