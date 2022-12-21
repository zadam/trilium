module.exports = () => {
    const cls = require("../../src/services/cls");
    const beccaLoader = require("../../src/becca/becca_loader");
    const becca = require("../../src/becca/becca");

    cls.init(() => {
        beccaLoader.load();

        for (const label of becca.getNote('_hidden').getLabels('archived')) {
            label.markAsDeleted('0208__remove_archived_from_hidden');
        }
    });
};
