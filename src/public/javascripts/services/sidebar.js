import NoteInfoWidget from "../widgets/note_info.js";
import LinkMapWidget from "../widgets/link_map.js";
import NoteRevisionsWidget from "../widgets/note_revisions.js";
import AttributesWidget from "../widgets/attributes.js";

class Sidebar {
    /**
     * @param {TabContext} ctx
     * @param {object} state
     */
    constructor(ctx, state = {}) {
        this.ctx = ctx;
        this.state = state;
        this.widgets = [];
        this.rendered = false;
        this.$sidebar = ctx.$tabContent.find(".note-detail-sidebar");
        this.$widgetContainer = this.$sidebar.find(".note-detail-widget-container");
        this.$showSideBarButton = this.ctx.$tabContent.find(".show-sidebar-button");
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

        this.$showSideBarButton.toggle(!state.visible);
        this.$sidebar.toggle(state.visible);
    }

    isVisible() {
        return this.$sidebar.css("display") !== "none";
    }

    getSidebarState() {
        return {
            visible: this.isVisible(),
            widgets: this.widgets.map(w => w.getWidgetState())
        }
    }

    async noteLoaded() {
        this.widgets = [];
        this.$widgetContainer.empty();

        const widgetClasses = [AttributesWidget, LinkMapWidget, NoteRevisionsWidget, NoteInfoWidget];

        for (const widgetClass of widgetClasses) {
            const state = (this.state.widgets || []).find(s => s.name === widgetClass.name);

            const widget = new widgetClass(this.ctx, state);
            this.widgets.push(widget);

            widget.renderBody(); // let it run in parallel

            this.$widgetContainer.append(widget.getWidgetElement());
        }
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