import libraryLoader from "../../services/library_loader.js";
import server from "../../services/server.js";
import optionsService from "../../services/options.js";

const TPL = `
<h4>Show sidebar in new tab</h4>

<div class="form-check">
    <input type="checkbox" class="form-check-input" id="show-sidebar-in-new-tab">
    <label class="form-check-label" for="show-sidebar-in-new-tab">Show sidebar in new tab</label>
</div>

<br>

<h4>Sidebar sizing</h4>

<div class="form-group row">
    <div class="col-6">
        <label for="sidebar-min-width">Sidebar minimum width (in pixels)</label>

        <div class="input-group">
            <input type="number" class="form-control" id="sidebar-min-width" min="100" max="2000" step="1"/>

            <div class="input-group-append">
                <span class="input-group-text">px</span>
            </div>
        </div>
    </div>

    <div class="col-6">
        <label for="left-pane-min-width">Sidebar width percent of the detail pane</label>

        <div class="input-group">
            <input type="number" class="form-control" id="sidebar-width-percent" min="0" max="70" step="1"/>

            <div class="input-group-append">
                <span class="input-group-text">%</span>
            </div>
        </div>
    </div>
</div>

<p>Sidebar width is calculated from the percent of the detail pane, if this is smaller than minimum width, then minimum width is used. If you want to have fixed width sidebar, set minimum width to the desired width and set percent to 0.</p>

<h4>Widgets</h4>

<div id="widgets-configuration" class="row">
    <h5 class="col-6">Enabled widgets</h5>

    <h5 class="col-6">Disabled widgets</h5>

    <div id="widgets-enabled" class="list-group col"></div>

    <div id="widgets-disabled" class="list-group col"></div>
</div>`;

export default class SidebarOptions {
    constructor() {
        $("#options-sidebar").html(TPL);

        this.$sidebarMinWidth = $("#sidebar-min-width");
        this.$sidebarWidthPercent = $("#sidebar-width-percent");
        this.$showSidebarInNewTab = $("#show-sidebar-in-new-tab");
        this.$widgetsConfiguration = $("#widgets-configuration");
        this.$widgetsEnabled = $("#widgets-enabled");
        this.$widgetsDisabled = $("#widgets-disabled");

        this.$sidebarMinWidth.change(async () => {
            await server.put('options/sidebarMinWidth/' + this.$sidebarMinWidth.val());

            this.resizeSidebar();
        });

        this.$sidebarWidthPercent.change(async () => {
            await server.put('options/sidebarWidthPercent/' + this.$sidebarWidthPercent.val());

            this.resizeSidebar();
        });

        this.$showSidebarInNewTab.change(async () => {
            const flag = this.$showSidebarInNewTab.is(":checked") ? 'true' : 'false';

            await server.put('options/showSidebarInNewTab/' + flag);

            optionsService.reloadOptions();
        });
    }

    async optionsLoaded(options) {
        this.$widgetsEnabled.empty();
        this.$widgetsDisabled.empty();

        this.$sidebarMinWidth.val(options.sidebarMinWidth);
        this.$sidebarWidthPercent.val(options.sidebarWidthPercent);

        if (parseInt(options.showSidebarInNewTab)) {
            this.$showSidebarInNewTab.attr("checked", "checked");
        }
        else {
            this.$showSidebarInNewTab.removeAttr("checked");
        }

        const widgets = [
            {name: 'attributes', title: 'Attributes'},
            {name: 'linkMap', title: 'Link map'},
            {name: 'noteInfo', title: 'Note info'},
            {name: 'noteRevisions', title: 'Note revisions'},
            {name: 'whatLinksHere', title: 'What links here'},
            {name: 'similarNotes', title: 'Similar notes'},
            {name: 'editedNotes', title: 'Edited notes (only on day note)'},
            {name: 'calendar', title: 'Calendar (only on day note)'}
        ].map(widget => {
            widget.option = this.parseJsonSafely(options[widget.name + 'Widget']) || {
                enabled: true,
                expanded: true,
                position: 1000
            };

            return widget;
        });

        widgets.sort((a, b) => a.option.position - b.option.position);

        for (const {name, title, option} of widgets) {
            const $widgetTitle = $('<div class="widget-title">')
                .attr('data-widget-name', name)
                .append($("<span>").addClass("handle bx bx-move"))
                .append($("<span>").text(title));

            const $expandedCheckbox = $('<div class="expansion-conf">')
                .attr("title", "If checked, the widget will be by default expanded (opened)")
                .append($(`<input type="checkbox"${option.expanded ? ' checked' : ''}>`)
                    .attr('id', 'widget-exp-' + name)
                    .change(() => this.save()))
                .append("&nbsp;")
                .append($("<label>")
                    .attr("for", 'widget-exp-' + name)
                    .text(" expanded"));

            const $el = $('<div>')
                .addClass("list-group-item")
                .append($widgetTitle)
                .append($expandedCheckbox);

            (option.enabled ? this.$widgetsEnabled : this.$widgetsDisabled).append($el);
        }

        await libraryLoader.requireLibrary(libraryLoader.SORTABLE);

        new Sortable(this.$widgetsEnabled[0], {
            group: 'widgets',
            handle: '.handle',
            animation: 150,
            onSort: evt => this.save()
        });

        new Sortable(this.$widgetsDisabled[0], {
            group: 'widgets',
            handle: '.handle',
            animation: 150,
            onSort: evt => this.save()
        });
    }

    async save() {
        const opts = {};

        this.$widgetsConfiguration.find('.list-group-item').each((i, el) => {
            const widgetName = $(el).find('div[data-widget-name]').attr('data-widget-name');

            opts[widgetName + 'Widget'] = JSON.stringify({
                enabled: $.contains(this.$widgetsEnabled[0], el),
                expanded: $(el).find("input[type=checkbox]").is(":checked"),
                position: (i + 1) * 100
            });
        });

        await server.put('options', opts);

        optionsService.reloadOptions();
    }

    parseJsonSafely(str) {
        try {
            return JSON.parse(str);
        }
        catch (e) {
            return null;
        }
    }

    resizeSidebar() {
        const sidebarWidthPercent = parseInt(this.$sidebarWidthPercent.val());
        const sidebarMinWidth = this.$sidebarMinWidth.val();

        // need to find them dynamically since they change
        const $sidebar = $(".note-detail-sidebar");

        const $content = $(".note-detail-content");

        $sidebar.css("width", sidebarWidthPercent + '%');
        $sidebar.css("min-width", sidebarMinWidth + 'px');

        $content.css("width", (100 - sidebarWidthPercent) + '%');
    }
}