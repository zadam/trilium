const eventService = require('./events');
const scriptService = require('./script');
const relationService = require('./relations');
const treeService = require('./tree');
const messagingService = require('./messaging');

eventService.subscribe(eventService.NOTE_TITLE_CHANGED, async note => {
    const relations = await relationService.getEffectiveRelations(note.noteId, 'runOnNoteTitleChange');

    for (const relation of relations) {
        const scriptNote = await relation.getTargetNote();

        await scriptService.executeNote(scriptNote, scriptNote, note);
    }

    if (!note.isRoot()) {
        const parents = await note.getParentNotes();

        for (const parent of parents) {
            if (await parent.hasLabel("sorted")) {
                await treeService.sortNotesAlphabetically(parent.noteId);

                messagingService.sendMessageToAllClients({ type: 'refresh-tree' });
            }
        }
    }
});