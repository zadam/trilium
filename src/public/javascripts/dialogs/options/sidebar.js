import libraryLoader from "../../services/library_loader.js";
import server from "../../services/server.js";
import optionsInit from "../../services/options_init.js";

export default class SidebarOptions {
    constructor() {
        this.$sidebarMinWidth = $("#sidebar-min-width");
        this.$sidebarWidthPercent = $("#sidebar-width-percent");
        this.$showSidebarInNewTab = $("#show-sidebar-in-new-tab");
        this.$widgetsActive = $("#widgets-active");
        this.$widgetsInactive = $("#widgets-inactive");

        const widgets = {
            attributes: 'Attributes',
            linkMap: 'Link map',
            noteInfo: 'Note info',
            noteRevisions: 'Note revisions',
            whatLinksHere: 'What links here'
        };

        for (const widgetName in widgets) {
            const $widgetTitle = $('<div class="widget-title">')
                .attr('data-widget-name', widgetName)
                .append($("<span>").addClass("handle jam jam-move"))
                .append($("<span>").text(widgets[widgetName]));

            const $expandedCheckbox = $('<div class="expansion-conf">')
                .attr("title", "If checked, the widget will be by default expanded (opened)")
                .append($('<input type="checkbox">')
                    .attr('id', 'widget-exp-' + widgetName))
                .append("&nbsp;")
                .append($("<label>")
                    .attr("for", 'widget-exp-' + widgetName)
                    .text(" expanded"));

            const $el = $('<div>')
                .addClass("list-group-item")
                .append($widgetTitle)
                .append($expandedCheckbox);

            this.$widgetsActive.append($el);
        }

        libraryLoader.requireLibrary(libraryLoader.SORTABLE).then(() => {
            new Sortable(this.$widgetsActive[0], {
                group: 'widgets',
                handle: '.handle',
                animation: 150
            });

            new Sortable(this.$widgetsInactive[0], {
                group: 'widgets',
                handle: '.handle',
                animation: 150
            });
        });

        this.$sidebarMinWidth.change(async () => {
            await server.put('options/sidebarMinWidth/' + this.$sidebarMinWidth.val());

            this.resizeSidebar();
        });

        this.$sidebarWidthPercent.change(async () => {
            await server.put('options/sidebarWidthPercent/' + this.$sidebarWidthPercent.val());

            this.resizeSidebar();
        });

        this.$showSidebarInNewTab.change(async () => {
            const flag = this.$showSidebarInNewTab.is(":checked") ? 1 : 0;

            await server.put('options/showSidebarInNewTab/' + flag);

            optionsInit.loadOptions();
        });
    }

    async optionsLoaded(options) {
        this.$sidebarMinWidth.val(options.sidebarMinWidth);
        this.$sidebarWidthPercent.val(options.sidebarWidthPercent);

        if (parseInt(options.showSidebarInNewTab)) {
            this.$showSidebarInNewTab.attr("checked", "checked");
        }
        else {
            this.$showSidebarInNewTab.removeAttr("checked");
        }
    }

    resizeSidebar() {
        const sidebarWidthPercent = parseInt(this.$sidebarWidthPercent.val());
        const sidebarMinWidth = this.$sidebarMinWidth.val();

        // need to find them dynamically since they change
        const $sidebar = $(".note-detail-sidebar");

        $sidebar.css("width", sidebarWidthPercent + '%');
        $sidebar.css("min-width", sidebarMinWidth + 'px');
    }
}