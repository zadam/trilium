module.exports = () => {
    const beccaLoader = require("../../src/becca/becca_loader");
    const becca = require("../../src/becca/becca");
    const cls = require("../../src/services/cls");
    const log = require("../../src/services/log");

    cls.init(() => {
        beccaLoader.load();

        for (const note of Object.values(becca.notes)) {
            try {
                if (!note.isJavaScript()) {
                    continue;
                }

                if (!note.mime?.endsWith('env=frontend') && !note.mime?.endsWith('env=backend')) {
                    continue;
                }

                const origContent = note.getContent().toString();
                const fixedContent = origContent
                    .replaceAll("runOnServer", "runOnBackend")
                    .replaceAll("api.refreshTree()", "")
                    .replaceAll("addTextToActiveTabEditor", "addTextToActiveContextEditor")
                    .replaceAll("getActiveTabNote", "getActiveContextNote")
                    .replaceAll("getActiveTabTextEditor", "getActiveContextTextEditor")
                    .replaceAll("getActiveTabNotePath", "getActiveContextNotePath")
                    .replaceAll("getDateNote", "getDayNote")
                    .replaceAll("utils.unescapeHtml", "unescapeHtml")
                    .replaceAll("sortNotesByTitle", "sortNotes")
                    .replaceAll("CollapsibleWidget", "RightPanelWidget")
                    .replaceAll("TabAwareWidget", "NoteContextAwareWidget")
                    .replaceAll("TabCachingWidget", "NoteContextAwareWidget")
                    .replaceAll("NoteContextCachingWidget", "NoteContextAwareWidget");

                if (origContent !== fixedContent) {
                    log.info(`Replacing legacy API calls for note '${note.noteId}'`);

                    note.saveNoteRevision();
                    note.setContent(fixedContent);
                }
            }
            catch (e) {
                log.error(`Error during migration to 213 for note '${note.noteId}': ${e.message} ${e.stack}`);
            }
        }
    });
};
