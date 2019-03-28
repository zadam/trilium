const $contextMenuContainer = $("#context-menu-container");

let dateContextMenuOpenedMs = 0;

function initContextMenu(event, itemContainer, selectContextMenuItem) {
    event.stopPropagation();

    $contextMenuContainer.empty();

    for (const item of itemContainer.getItems()) {
        if (item.title === '----') {
            $contextMenuContainer.append($("<div>").addClass("dropdown-divider"));
        } else {
            const $icon = $("<span>");

            if (item.uiIcon) {
                $icon.addClass("jam jam-" + item.uiIcon);
            } else {
                $icon.append("&nbsp;");
            }

            const $item = $("<a>")
                .append($icon)
                .append(" &nbsp; ") // some space between icon and text
                .addClass("dropdown-item")
                .prop("data-cmd", item.cmd)
                .append(item.title);


            if (item.enabled !== undefined && !item.enabled) {
                $item.addClass("disabled");
            }

            $item.click(async function (e) {
                const cmd = $(e.target).prop("data-cmd");

                e.originalTarget = event.target;

                await selectContextMenuItem(e, cmd);
            });

            $contextMenuContainer.append($item);
        }
    }

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