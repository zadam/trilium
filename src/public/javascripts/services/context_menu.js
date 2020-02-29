import keyboardActionService from './keyboard_actions.js';

class ContextMenu {
    constructor() {
        this.$widget = $("#context-menu-container");
        this.dateContextMenuOpenedMs = 0;

        $(document).on('click', () => this.hide());
    }
    
    async show(options) {
        this.options = options;
        
        this.$widget.empty();

        this.addItems(this.$widget, options.items);

        keyboardActionService.updateDisplayedShortcuts(this.$widget);

        this.positionMenu();

        this.dateContextMenuOpenedMs = Date.now();
    }

    positionMenu() {
        // code below tries to detect when dropdown would overflow from page
        // in such case we'll position it above click coordinates so it will fit into client
        const clientHeight = document.documentElement.clientHeight;
        const contextMenuHeight = this.$widget.outerHeight() + 30;
        let top;

        if (this.options.y + contextMenuHeight > clientHeight) {
            top = clientHeight - contextMenuHeight - 10;
        } else {
            top = this.options.y - 10;
        }

        this.$widget.css({
            display: "block",
            top: top,
            left: this.options.x - 20
        }).addClass("show");
    }

    addItems($parent, items) {
        for (const item of items) {
            if (item.title === '----') {
                $parent.append($("<div>").addClass("dropdown-divider"));
            } else {
                const $icon = $("<span>");

                if (item.uiIcon) {
                    $icon.addClass("bx bx-" + item.uiIcon);
                } else {
                    $icon.append("&nbsp;");
                }

                const $link = $("<span>")
                    .append($icon)
                    .append(" &nbsp; ") // some space between icon and text
                    .append(item.title);

                const $item = $("<li>")
                    .addClass("dropdown-item")
                    .append($link)
                    // important to use mousedown instead of click since the former does not change focus
                    // (especially important for focused text for spell check)
                    .on('mousedown', (e) => {
                        e.stopPropagation();

                        this.hide();

                        if (item.handler) {
                            item.handler(item, e);
                        }

                        this.options.selectMenuItemHandler(item, e);

                        // it's important to stop the propagation especially for sub-menus, otherwise the event
                        // might be handled again by top-level menu
                        return false;
                    });

                if (item.enabled !== undefined && !item.enabled) {
                    $item.addClass("disabled");
                }

                if (item.items) {
                    $item.addClass("dropdown-submenu");
                    $link.addClass("dropdown-toggle");

                    const $subMenu = $("<ul>").addClass("dropdown-menu");

                    this.addItems($subMenu, item.items);

                    $item.append($subMenu);
                }

                $parent.append($item);
            }
        }
    }

    hide() {
        // this date checking comes from change in FF66 - https://github.com/zadam/trilium/issues/468
        // "contextmenu" event also triggers "click" event which depending on the timing can close just opened context menu
        // we might filter out right clicks, but then it's better if even right clicks close the context menu
        if (Date.now() - this.dateContextMenuOpenedMs > 300) {
            this.$widget.hide();
        }
    }
}

const contextMenu = new ContextMenu();

export default contextMenu;