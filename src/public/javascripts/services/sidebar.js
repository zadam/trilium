import bundleService from "./bundle.js";
import ws from "./ws.js";
import optionsService from "./options.js";

class Sidebar {
    /**
     * @param {TabContext} ctx
     * @param {object} state
     */
    constructor(ctx, state = {}) {
        /** @property {TabContext} */
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
            this.noteLoaded();
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
        if (!this.isVisible() || !this.ctx.note) {
            return;
        }

        this.widgets = [];
        this.$widgetContainer.empty();

        const widgetClasses = (await Promise.all([
            import("../widgets/note_info.js"),
            import("../widgets/link_map.js"),
            import("../widgets/note_revisions.js"),
            import("../widgets/attributes.js"),
            import("../widgets/what_links_here.js")
        ])).map(m => m.default);

        const options = await optionsService.waitForOptions();

        const widgetRelations = await this.ctx.note.getRelations('widget');

        for (const widgetRelation of widgetRelations) {
            const widgetClass = await bundleService.getAndExecuteBundle(widgetRelation.value, this.ctx.note);

            widgetClasses.push(widgetClass);
        }

        for (const widgetClass of widgetClasses) {
            const state = (this.state.widgets || []).find(s => s.name === widgetClass.name);

            try {
                const widget = new widgetClass(this.ctx, options, state);

                if (await widget.isEnabled()) {
                    this.widgets.push(widget);
                }
            }
            catch (e) {
                ws.logError(`Error while creating widget ${widgetClass.name}: ${e.message}`);
            }
        }

        this.widgets.sort((a, b) => a.getPosition() < b.getPosition() ? -1 : 1);

        for (const widget of this.widgets) {
            try {
                const $el = await widget.render();
                this.$widgetContainer.append($el);
            }
            catch (e) {
                ws.logError(`Error while loading widget ${widget.widgetName}: ${e.message}`);
            }
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