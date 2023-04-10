module.exports = () => {
    const cls = require("../../src/services/cls");
    const beccaLoader = require("../../src/becca/becca_loader");
    const becca = require("../../src/becca/becca");
    const log = require("../../src/services/log");

    cls.init(() => {
        beccaLoader.load();

        const hidden = becca.getNote("_hidden");

        if (!hidden) {
            log.info("MIGRATION 212: no _hidden note, skipping.");
            return;
        }

        for (const noteId of hidden.getSubtreeNoteIds({includeHidden: true})) {
            if (noteId.startsWith("_")) { // is "named" note
                const note = becca.getNote(noteId);

                for (const attr of note.getOwnedAttributes()) {
                    attr.markAsDeleted("0212__delete_all_attributes_of_named_notes");
                }
            }
        }
    });
};
