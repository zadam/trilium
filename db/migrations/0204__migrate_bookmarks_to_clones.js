module.exports = () => {
    const cls = require("../../src/services/cls");
    const cloningService = require("../../src/services/cloning");
    const beccaLoader = require("../../src/becca/becca_loader");
    const becca = require("../../src/becca/becca");

    cls.init(() => {
        beccaLoader.load();

        for (const attr of becca.findAttributes('label','bookmarked')) {
            cloningService.toggleNoteInParent(true, attr.noteId, '_lbBookmarks');

            attr.markAsDeleted("0204__migrate_bookmarks_to_clones");
        }

        // bookmarkFolder used to work in 0.57 without the bookmarked label
        for (const attr of becca.findAttributes('label','bookmarkFolder')) {
            cloningService.toggleNoteInParent(true, attr.noteId, '_lbBookmarks');
        }
    });
};
