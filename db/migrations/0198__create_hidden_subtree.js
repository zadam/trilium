module.exports = () => {
    const specialNotesService = require('../../src/services/special_notes');
    const cls = require("../../src/services/cls");
    const beccaLoader = require("../../src/becca/becca_loader");

    cls.init(() => {
        beccaLoader.load();
        specialNotesService.getHiddenRoot();
    });
};
