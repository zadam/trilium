module.exports = () => {
    const hiddenSubtreeService = require('../../src/services/hidden_subtree');
    const cls = require("../../src/services/cls");
    const beccaLoader = require("../../src/becca/becca_loader");

    cls.init(() => {
        beccaLoader.load();
        // create it because it subsequent migrations we will move some existing notes into it (share...)
        hiddenSubtreeService.checkHiddenSubtree();
    });
};
