let instance;

function setupSplitWithSidebar() {
    if (instance) {
        instance.destroy();
    }

    instance = Split(['#left-pane', '#center-pane', '#right-pane'], {
        sizes: [25, 50, 25],
        gutterSize: 5
    });
}

function setupSplitWithoutSidebar() {
    if (instance) {
        instance.destroy();
    }

    instance = Split(['#left-pane', '#center-pane'], {
        sizes: [25, 75],
        gutterSize: 5
    });
}

export default {
    setupSplitWithSidebar,
    setupSplitWithoutSidebar
};