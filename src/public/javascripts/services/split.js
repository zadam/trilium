import server from "./server.js";
import optionService from "./options.js";

let instance;

async function getPaneWidths() {
    const options = await optionService.waitForOptions();

    return {
        leftPaneWidth: options.getInt('leftPaneWidth'),
        rightPaneWidth: options.getInt('rightPaneWidth')
    };
}

async function setupSplitWithSidebar() {
    if (instance) {
        instance.destroy();
    }

    const {leftPaneWidth, rightPaneWidth} = await getPaneWidths();

    instance = Split(['#left-pane', '#center-pane', '#right-pane'], {
        sizes: [leftPaneWidth, 100 - leftPaneWidth - rightPaneWidth, rightPaneWidth],
        gutterSize: 5,
        onDragEnd: sizes => {
            server.put('options/leftPaneWidth/' + Math.round(sizes[0]));
            server.put('options/rightPaneWidth/' + Math.round(sizes[2]));
        }
    });
}

async function setupSplitWithoutSidebar() {
    if (instance) {
        instance.destroy();
    }

    const {leftPaneWidth} = await getPaneWidths();

    instance = Split(['#left-pane', '#center-pane'], {
        sizes: [leftPaneWidth, 100 - leftPaneWidth],
        gutterSize: 5,
        onDragEnd: sizes => {
            server.put('options/leftPaneWidth/' + Math.round(sizes[0]));
        }
    });
}

export default {
    setupSplitWithSidebar,
    setupSplitWithoutSidebar
};