const eventService = require('./events');
const scriptService = require('./script');
const treeService = require('./tree');
const messagingService = require('./messaging');
const repository = require('./repository');

async function runAttachedRelations(note, relationName, originEntity) {
    const attributes = await note.getAttributes();
    const runRelations = attributes.filter(relation => relation.type === 'relation' && relation.name === relationName);

    for (const relation of runRelations) {
        const scriptNote = await relation.getTargetNote();

        await scriptService.executeNote(scriptNote, originEntity);
    }
}

eventService.subscribe(eventService.NOTE_TITLE_CHANGED, async note => {
    await runAttachedRelations(note, 'runOnNoteTitleChange', note);

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

eventService.subscribe(eventService.ENTITY_CHANGED, async ({ entityId, entityName }) => {
    if (entityName === 'attributes') {
        const attribute = await repository.getEntityFromName(entityName, entityId);

        await runAttachedRelations(await attribute.getNote(), 'runOnAttributeChange', attribute);
    }
});