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
        this.state = Object.assign({
            widgets: []
        }, state);
        this.widgets = [];
        this.$sidebar = ctx.$tabContent.find(".note-detail-sidebar");
        this.$widgetContainer = this.$sidebar.find(".note-detail-widget-container");
        this.$showSideBarButton = this.ctx.$tabContent.find(".show-sidebar-button");
        this.$hideSidebarButton = this.$sidebar.find(".hide-sidebar-button");

        this.$hideSidebarButton.on('click', () => {
            this.$sidebar.hide();
            this.$showSideBarButton.show();
            this.ctx.stateChanged();
        });

        this.$showSideBarButton.on('click', () => {
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

        const widgetClasses = (await Promise.all([
            import("../widgets/note_info.js"),
            import("../widgets/link_map.js"),
            import("../widgets/note_revisions.js"),
            import("../widgets/attributes.js"),
            import("../widgets/what_links_here.js"),
            import("../widgets/similar_notes.js"),
            import("../widgets/edited_notes.js"),
            import("../widgets/calendar.js")
        ])).map(m => m.default);

        const options = await optionsService.waitForOptions();

        const widgetRelations = await this.ctx.note.getRelations('widget');

        for (const widgetRelation of widgetRelations) {
            const widgetClass = await bundleService.getAndExecuteBundle(widgetRelation.value, this.ctx.note);

            widgetClasses.push(widgetClass);
        }

        const widgets = [];

        for (const widgetClass of widgetClasses) {
            try {
                const widget = new widgetClass(this.ctx, options, this.state);

                if (await widget.isEnabled()) {
                    widgets.push(widget);
                }
            }
            catch (e) {
                ws.logError(`Error while creating widget ${widgetClass.name}: ${e.message}`);
            }
        }

        this.renderWidgets(widgets);
    }

    // it's important that this method is sync so that the whole render-update is atomic
    // otherwise we could get race issues (doubled widgets etc.)
    renderWidgets(widgets) {
        // cleanup old widgets
        for (const widget of this.widgets) {
            if (widget.cleanup) {
                widget.cleanup();
            }
        }

        this.widgets = widgets;
        this.widgets.sort((a, b) => a.getPosition() < b.getPosition() ? -1 : 1);

        const widgetsToAppend = [];

        for (const widget of this.widgets) {
            try {
                const $el = widget.render();
                widgetsToAppend.push($el);
            } catch (e) {
                ws.logError(`Error while rendering widget ${widget.widgetName}: ${e.message}`);
            }
        }

        // update at once to reduce flickering
        this.$widgetContainer.empty().append(...widgetsToAppend);
    }

    eventReceived(name, data) {
        for (const widget of this.widgets) {
            if (widget.eventReceived) {
                widget.eventReceived(name, data);
            }
        }
    }
}

export default Sidebar;