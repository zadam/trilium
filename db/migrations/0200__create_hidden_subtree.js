module.exports = () => {
    const hiddenSubtreeService = require('../../src/services/hidden_subtree');
    const cls = require("../../src/services/cls");
    const beccaLoader = require("../../src/becca/becca_loader");

    cls.init(() => {
        beccaLoader.load();
        // make sure the hidden subtree exists since the subsequent migrations we will move some existing notes into it (share...)
        // in previous releases hidden subtree was created lazily
        hiddenSubtreeService.checkHiddenSubtree(true);
    });
};
