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

        libraryLoader.requireLibrary(libraryLoader.SORTABLE).then(() => {
            new Sortable(this.$widgetsActive[0], {
                group: 'shared',
                animation: 150
            });

            new Sortable(this.$widgetsInactive[0], {
                group: 'shared',
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