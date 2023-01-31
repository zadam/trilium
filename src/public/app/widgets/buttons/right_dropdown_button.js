import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="dropdown right-dropdown-widget dropright">
    <style>
    .right-dropdown-widget {
        height: 53px;
    }
    </style>

    <button type="button" data-toggle="dropdown" data-placement="right"
            aria-haspopup="true" aria-expanded="false" 
            class="bx right-dropdown-button launcher-button"></button>
    
    <div class="dropdown-menu dropdown-menu-right"></div>
</div>
`;

export default class RightDropdownButtonWidget extends BasicWidget {
    constructor(title, iconClass, dropdownTpl) {
        super();

        this.iconClass = iconClass;
        this.title = title;
        this.dropdownTpl = dropdownTpl;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$dropdownMenu = this.$widget.find(".dropdown-menu");

        const $button = this.$widget.find(".right-dropdown-button")
            .addClass(this.iconClass)
            .attr("title", this.title)
            .tooltip({ trigger: "hover" })
            .on("click", () => $button.tooltip("hide"));

        this.$widget.on('show.bs.dropdown', async () => {
            await this.dropdownShown();

            const rect = this.$dropdownMenu[0].getBoundingClientRect();
            const pixelsToBottom = $(window).height() - rect.bottom;

            if (pixelsToBottom < 0) {
                this.$dropdownMenu.css("top", pixelsToBottom);
            }
        });

        this.$dropdownContent = $(this.dropdownTpl);
        this.$widget.find(".dropdown-menu").append(this.$dropdownContent);
    }

    // to be overriden
    async dropdownShow() {}

    hideDropdown() {
        this.$widget.dropdown("hide");
        this.$dropdownMenu.removeClass("show");
    }
}
