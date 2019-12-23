import bundleService from "./bundle.js";
import ws from "./ws.js";
import optionsService from "./options.js";
import splitService from "./split.js";

const $sidebar = $("#right-pane");
const $sidebarContainer = $('#sidebar-container');

const $showSideBarButton = $("#show-sidebar-button");
const $hideSidebarButton = $("#hide-sidebar-button");

$showSideBarButton.hide();

$hideSidebarButton.on('click', () => {
    $sidebar.hide();
    $showSideBarButton.show();
    $hideSidebarButton.hide();

    splitService.setupSplitWithoutSidebar();
});

// FIXME shoud run note loaded!
$showSideBarButton.on('click', () => {
    $sidebar.show();
    $showSideBarButton.hide();
    $hideSidebarButton.show();

    splitService.setupSplitWithSidebar();
});

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

        this.$widgetContainer = $sidebar.find(`.sidebar-widget-container[data-tab-id=${this.ctx.tabId}]`);

        if (this.$widgetContainer.length === 0) {
            this.$widgetContainer = $(`<div class="sidebar-widget-container">`).attr('data-tab-id', this.ctx.tabId);

            $sidebarContainer.append(this.$widgetContainer);
        }
    }

    isVisible() {
        return $sidebar.css("display") !== "none";
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

    show() {
        $sidebarContainer.find('.sidebar-widget-container').each((i, el) => {
            $(el).toggle($(el).attr('data-tab-id') === this.ctx.tabId);
        });
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