function Api() {
    const $pluginButtons = $("#plugin-buttons");

    async function activateNote(notePath) {
        await noteTree.activateNode(notePath);
    }

    function addButtonToToolbar(buttonId, button) {
        $("#" + buttonId).remove();

        button.attr('id', buttonId);

        $pluginButtons.append(button);
    }

    function prepareParams(params) {
        if (!params) {
            return params;
        }

        return params.map(p => {
            if (typeof p === "function") {
                return "!@#Function: " + p.toString();
            }
            else {
                return p;
            }
        });
    }

    async function runOnServer(script, params) {
        if (typeof script === "function") {
            script = script.toString();
        }

        const ret = await server.post('script/exec', { script: script, params: prepareParams(params) });

        return ret.executionResult;
    }

    return {
        __modules: {},
        __notes: {},
        addButtonToToolbar,
        activateNote,
        getInstanceName: noteTree.getInstanceName,
        runOnServer
    }
}