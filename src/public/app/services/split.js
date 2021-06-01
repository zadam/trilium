import options from "./options.js";

let instance;

function setupSplit(leftPaneVisible) {
    if (instance) {
        instance.destroy();
        instance = null;
    }

    $("#tree-sidebar").toggle(leftPaneVisible);

    if (!leftPaneVisible) {
        $("#center-pane").css('width', '100%');

        return;
    }

    let leftPaneWidth = options.getInt('leftPaneWidth');
    if (!leftPaneWidth || leftPaneWidth < 5) {
        leftPaneWidth = 5;
    }

    if (leftPaneVisible) {
        instance = Split(['#tree-sidebar', '#center-pane'], {
            sizes: [leftPaneWidth, 100 - leftPaneWidth],
            gutterSize: 5,
            onDragEnd: sizes => options.save('leftPaneWidth', Math.round(sizes[0]))
        });
    }
}

export default {
    setupSplit
};
