import options from "./options.js";

let leftInstance;
let rightInstance;

function setupLeftPaneResizer(leftPaneVisible) {
    if (leftInstance) {
        leftInstance.destroy();
        leftInstance = null;
    }

    $("#left-pane").toggle(leftPaneVisible);

    if (!leftPaneVisible) {
        $("#rest-pane").css('width', '100%');

        return;
    }

    let leftPaneWidth = options.getInt('leftPaneWidth');
    if (!leftPaneWidth || leftPaneWidth < 5) {
        leftPaneWidth = 5;
    }

    if (leftPaneVisible) {
        leftInstance = Split(['#left-pane', '#rest-pane'], {
            sizes: [leftPaneWidth, 100 - leftPaneWidth],
            gutterSize: 5,
            onDragEnd: sizes => options.save('leftPaneWidth', Math.round(sizes[0]))
        });
    }
}

function setupRightPaneResizer() {
    if (rightInstance) {
        rightInstance.destroy();
        rightInstance = null;
    }

    const rightPaneVisible = $("#right-pane").is(":visible");

    if (!rightPaneVisible) {
        $("#center-pane").css('width', '100%');

        return;
    }

    let rightPaneWidth = options.getInt('rightPaneWidth');
    if (!rightPaneWidth || rightPaneWidth < 5) {
        rightPaneWidth = 5;
    }

    if (rightPaneVisible) {
        rightInstance = Split(['#center-pane', '#right-pane'], {
            sizes: [100 - rightPaneWidth, rightPaneWidth],
            gutterSize: 5,
            onDragEnd: sizes => options.save('rightPaneWidth', Math.round(sizes[1]))
        });
    }
}

export default {
    setupLeftPaneResizer,
    setupRightPaneResizer,
};
