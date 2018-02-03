const api = (function() {
    const pluginButtonsEl = $("#plugin-buttons");

    async function activateNote(notePath) {
        await noteTree.activateNode(notePath);
    }

    function addButtonToToolbar(buttonId, button) {
        $("#" + buttonId).remove();

        button.attr('id', buttonId);

        pluginButtonsEl.append(button);
    }


    return {
        addButtonToToolbar,
        activateNote
    }
})();