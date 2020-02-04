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

async function setupSplit(left, right) {
    if (instance) {
        instance.destroy();
        instance = null;
    }

    if (!left && !right) {
        $("#center-pane").css('width', '100%');

        return;
    }

    const {leftPaneWidth, rightPaneWidth} = await getPaneWidths();

    if (left && right) {
        instance = Split(['#left-pane', '#center-pane', '#right-pane'], {
            sizes: [leftPaneWidth, 100 - leftPaneWidth - rightPaneWidth, rightPaneWidth],
            gutterSize: 5,
            onDragEnd: sizes => {
                server.put('options/leftPaneWidth/' + Math.round(sizes[0]));
                server.put('options/rightPaneWidth/' + Math.round(sizes[2]));
            }
        });
    }
    else if (left) {
        instance = Split(['#left-pane', '#center-pane'], {
            sizes: [leftPaneWidth, 100 - leftPaneWidth],
            gutterSize: 5,
            onDragEnd: sizes => {
                server.put('options/leftPaneWidth/' + Math.round(sizes[0]));
            }
        });
    }
    else if (right) {
        instance = Split(['#center-pane', '#right-pane'], {
            sizes: [100 - rightPaneWidth, rightPaneWidth],
            gutterSize: 5,
            onDragEnd: sizes => {
                server.put('options/rightPaneWidth/' + Math.round(sizes[1]));
            }
        });
    }
}

export default {
    setupSplit
};