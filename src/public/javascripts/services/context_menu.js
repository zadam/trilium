import keyboardActionService from './keyboard_actions.js';
const $contextMenuContainer = $("#context-menu-container");

let dateContextMenuOpenedMs = 0;

async function initContextMenu(options) {
    function addItems($parent, items) {
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
                    .on('mousedown', function (e) {
                        e.stopPropagation();

                        hideContextMenu();

                        e.originalTarget = event.target;

                        options.selectContextMenuItem(e, item);

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

                    addItems($subMenu, item.items);

                    $item.append($subMenu);
                }

                $parent.append($item);
            }
        }
    }

    $contextMenuContainer.empty();

    addItems($contextMenuContainer, options.items);

    keyboardActionService.updateDisplayedShortcuts($contextMenuContainer);

    // code below tries to detect when dropdown would overflow from page
    // in such case we'll position it above click coordinates so it will fit into client
    const clientHeight = document.documentElement.clientHeight;
    const contextMenuHeight = $contextMenuContainer.outerHeight() + 30;
    let top;

    if (options.y + contextMenuHeight > clientHeight) {
        top = clientHeight - contextMenuHeight - 10;
    } else {
        top = options.y - 10;
    }

    dateContextMenuOpenedMs = Date.now();

    $contextMenuContainer.css({
        display: "block",
        top: top,
        left: options.x - 20
    }).addClass("show");
}

$(document).on('click', () => hideContextMenu());

function hideContextMenu() {
    // this date checking comes from change in FF66 - https://github.com/zadam/trilium/issues/468
    // "contextmenu" event also triggers "click" event which depending on the timing can close just opened context menu
    // we might filter out right clicks, but then it's better if even right clicks close the context menu
    if (Date.now() - dateContextMenuOpenedMs > 300) {
        $contextMenuContainer.hide();
    }
}

export default {
    initContextMenu,
    hideContextMenu
}