const $contextMenuContainer = $("#context-menu-container");

let dateContextMenuOpenedMs = 0;

/**
 * @param event - originating click event (used to get coordinates to display menu at position)
 * @param {object} contextMenu - needs to have getContextMenuItems() and selectContextMenuItem(e, cmd)
 */
async function initContextMenu(event, contextMenu) {
    event.stopPropagation();

    $contextMenuContainer.empty();

    function addItems($parent, items) {
        for (const item of items) {
            if (item.title === '----') {
                $parent.append($("<div>").addClass("dropdown-divider"));
            } else {
                const $icon = $("<span>");

                if (item.uiIcon) {
                    $icon.addClass("jam jam-" + item.uiIcon);
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
                    .attr("data-cmd", item.cmd)
                    .click(function (e) {
                        const cmd = $(e.target).closest(".dropdown-item").attr("data-cmd");

                        e.originalTarget = event.target;

                        contextMenu.selectContextMenuItem(e, cmd);

                        hideContextMenu();

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

    addItems($contextMenuContainer, await contextMenu.getContextMenuItems());

    // code below tries to detect when dropdown would overflow from page
    // in such case we'll position it above click coordinates so it will fit into client
    const clickPosition = event.pageY;
    const clientHeight = document.documentElement.clientHeight;
    const contextMenuHeight = $contextMenuContainer.height();

    let top;

    if (clickPosition + contextMenuHeight > clientHeight) {
        top = clientHeight - contextMenuHeight - 10;
    } else {
        top = event.pageY - 10;
    }

    dateContextMenuOpenedMs = Date.now();

    $contextMenuContainer.css({
        display: "block",
        top: top,
        left: event.pageX - 20
    }).addClass("show");
}

$(document).click(() => hideContextMenu());

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