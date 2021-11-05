const becca = require('../../src/becca/becca');
const beccaLoader = require('../../src/becca/becca_loader');
const cls = require('../../src/services/cls');

module.exports = () => {
    cls.init(() => {
        beccaLoader.load();

        for (const note of Object.values(becca.notes)) {
            if (note.hasLabel('calendarRoot')) {
                note.addLabel('excludeFromNoteMap', "", true);
            }
        }
    });
};
