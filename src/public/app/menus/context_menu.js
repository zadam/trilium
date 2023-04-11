import keyboardActionService from '../services/keyboard_actions.js';

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
        // in such case we'll position it above click coordinates, so it will fit into client

        const CONTEXT_MENU_PADDING = 5; // How many pixels to pad context menu from edge of screen
        const CONTEXT_MENU_OFFSET = 0; // How many pixels to offset context menu by relative to cursor, see #3157

        const clientHeight = document.documentElement.clientHeight;
        const clientWidth = document.documentElement.clientWidth;
        const contextMenuHeight = this.$widget.outerHeight();
        const contextMenuWidth = this.$widget.outerWidth();
        let top, left;

        if (this.options.y + contextMenuHeight - CONTEXT_MENU_OFFSET > clientHeight - CONTEXT_MENU_PADDING) {
            // Overflow: bottom
            top = clientHeight - contextMenuHeight - CONTEXT_MENU_PADDING;
        } else if (this.options.y - CONTEXT_MENU_OFFSET < CONTEXT_MENU_PADDING) {
            // Overflow: top
            top = CONTEXT_MENU_PADDING;
        } else {
            top = this.options.y - CONTEXT_MENU_OFFSET;
        }

        if (this.options.orientation === 'left') {
            if (this.options.x + CONTEXT_MENU_OFFSET > clientWidth - CONTEXT_MENU_PADDING) {
                // Overflow: right
                left = clientWidth - contextMenuWidth - CONTEXT_MENU_OFFSET;
            } else if (this.options.x - contextMenuWidth + CONTEXT_MENU_OFFSET < CONTEXT_MENU_PADDING) {
                // Overflow: left
                left = CONTEXT_MENU_PADDING;
            } else {
                left = this.options.x - contextMenuWidth + CONTEXT_MENU_OFFSET;
            }
        } else {
            if (this.options.x + contextMenuWidth - CONTEXT_MENU_OFFSET > clientWidth - CONTEXT_MENU_PADDING) {
                // Overflow: right
                left = clientWidth - contextMenuWidth - CONTEXT_MENU_PADDING;
            } else if (this.options.x - CONTEXT_MENU_OFFSET < CONTEXT_MENU_PADDING) {
                // Overflow: left
                left = CONTEXT_MENU_PADDING;
            } else {
                left = this.options.x - CONTEXT_MENU_OFFSET;
            }
        }

        this.$widget.css({
            display: "block",
            top: top,
            left: left
        }).addClass("show");
    }

    addItems($parent, items) {
        for (const item of items) {
            if (!item) {
                continue;
            }

            if (item.title === '----') {
                $parent.append($("<div>").addClass("dropdown-divider"));
            } else {
                const $icon = $("<span>");

                if (item.uiIcon) {
                    $icon.addClass(item.uiIcon);
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
                    .on('contextmenu', e => false)
                    // important to use mousedown instead of click since the former does not change focus
                    // (especially important for focused text for spell check)
                    .on('mousedown', e => {
                        e.stopPropagation();

                        if (e.which !== 1) { // only left click triggers menu items
                            return false;
                        }

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
            // seems like if we hide the menu immediately, some clicks can get propagated to the underlying component
            // see https://github.com/zadam/trilium/pull/3805 for details
            setTimeout(() => this.$widget.hide(), 100);
        }
    }
}

const contextMenu = new ContextMenu();

export default contextMenu;
