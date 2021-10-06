import BasicWidget from "../basic_widget.js";

const TPL = `
<div class="dropdown right-dropdown-widget dropright">
    <style>
    .right-dropdown-widget {
        width: 53px;
        height: 53px;
    }
    </style>

    <button type="button" data-toggle="dropdown" data-placement="right"
            aria-haspopup="true" aria-expanded="false" 
            class="icon-action bx right-dropdown-button"></button>
    
    <div class="dropdown-menu dropdown-menu-right"></div>
</div>
`;

export default class RightDropdownButtonWidget extends BasicWidget {
    constructor(iconClass, title, dropdownTpl) {
        super();

        this.iconClass = iconClass;
        this.title = title;
        this.dropdownTpl = dropdownTpl;
    }

    doRender() {
        this.$widget = $(TPL);

        const $button = this.$widget.find(".right-dropdown-button")
            .addClass(this.iconClass)
            .attr("title", this.title)
            .tooltip({ trigger: "hover" })
            .on("click", () => $button.tooltip("hide"));

        this.$widget.on('show.bs.dropdown', () => this.dropdown());

        this.$dropdownContent = $(this.dropdownTpl);
        this.$widget.find(".dropdown-menu").append(this.$dropdownContent);
    }

    // to be overriden
    dropdown() {}

    hideDropdown() {
        this.$widget.dropdown("hide");
    }
}
