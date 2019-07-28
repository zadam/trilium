import NoteInfoWidget from "../widgets/note_info.js";
import LinkMapWidget from "../widgets/link_map.js";
import NoteRevisionsWidget from "../widgets/note_revisions.js";

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
        this.$sidebar = ctx.$tabContent.find(".note-detail-sidebar");
        this.$widgets = this.$sidebar.find(".note-detail-widgets");
        this.$showSideBarButton = this.ctx.$tabContent.find(".show-sidebar-button");
        this.$showSideBarButton.hide();

        this.$hideSidebarButton = this.$sidebar.find(".hide-sidebar-button");

        this.$hideSidebarButton.click(() => {
            this.$sidebar.hide();
            this.$showSideBarButton.show();
        });

        this.$showSideBarButton.click(() => {
            this.$sidebar.show();
            this.$showSideBarButton.hide();
        });
    }

    async noteLoaded() {
        this.$widgets.empty();

        this.addNoteInfoWidget();
        this.addLinkMapWidget();
        this.addNoteRevisionsWidget();
    }

    async addNoteInfoWidget() {
        const $widget = this.createWidgetElement();

        const noteInfoWidget = new NoteInfoWidget(this.ctx, $widget);
        await noteInfoWidget.renderBody();

        this.$widgets.append($widget);
    }

    async addLinkMapWidget() {
        const $widget = this.createWidgetElement();

        const linkMapWidget = new LinkMapWidget(this.ctx, $widget);
        await linkMapWidget.renderBody();

        this.$widgets.append($widget);
    }

    async addNoteRevisionsWidget() {
        const $widget = this.createWidgetElement();

        const noteRevisionsWidget = new NoteRevisionsWidget(this.ctx, $widget);
        await noteRevisionsWidget.renderBody();

        this.$widgets.append($widget);
    }

    createWidgetElement() {
        const widgetId = 'widget-' + widgetIdCtr++;

        const $widget = $(WIDGET_TPL);
        $widget.find('[data-target]').attr('data-target', "#" + widgetId);
        $widget.find('.body-wrapper').attr('id', widgetId);

        return $widget;
    }
}

export default Sidebar;