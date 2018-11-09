const $contextMenuContainer = $("#context-menu-container");

function initContextMenu(event, contextMenuItems, selectContextMenuItem) {
    $contextMenuContainer.empty();

    for (const item of contextMenuItems) {
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

    $contextMenuContainer.css({
        display: "block",
        top: top,
        left: event.pageX - 20
    }).addClass("show");
}

$(document).click(() => $contextMenuContainer.hide());

export default {
    initContextMenu
}