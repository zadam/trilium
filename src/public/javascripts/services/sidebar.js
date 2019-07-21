class Sidebar {
    /**
     * @param {TabContext} ctx
     */
    constructor(ctx) {
        this.ctx = ctx;
        this.$sidebar = ctx.$tabContent.find(".note-detail-sidebar");
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
        })
    }
}

export default Sidebar;