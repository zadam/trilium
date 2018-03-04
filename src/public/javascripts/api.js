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

    return {
        __modules: {},
        __notes: {},
        addButtonToToolbar,
        activateNote,
        getInstanceName: noteTree.getInstanceName
    }
}