const api = (function() {
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
        addButtonToToolbar,
        activateNote,
        getInstanceName: noteTree.getInstanceName
    }
})();