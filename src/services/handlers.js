const eventService = require('./events');
const scriptService = require('./script');
const treeService = require('./tree');
const messagingService = require('./messaging');

eventService.subscribe(eventService.NOTE_TITLE_CHANGED, async note => {
    const attributes = await note.getAttributes();
    const runRelations = attributes.filter(relation => relation.type === 'relation' && relation.name === 'runOnNoteTitleChange');

    for (const relation of runRelations) {
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