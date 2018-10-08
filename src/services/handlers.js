const eventService = require('./events');
const scriptService = require('./script');
const treeService = require('./tree');
const messagingService = require('./messaging');
const log = require('./log');

async function runAttachedRelations(note, relationName, originEntity) {
    const runRelations = (await note.getRelations()).filter(relation => relation.name === relationName);

    for (const relation of runRelations) {
        const scriptNote = await relation.getTargetNote();

        if (scriptNote) {
            await scriptService.executeNote(scriptNote, originEntity);
        }
        else {
            log.error(`Target note ${relation.value} of atttribute ${relation.attributeId} has not been found.`);
        }
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
                break; // sending the message once is enough
            }
        }
    }
});

eventService.subscribe(eventService.ENTITY_CHANGED, async ({ entityName, entity }) => {
    if (entityName === 'attributes') {
        await runAttachedRelations(await entity.getNote(), 'runOnAttributeChange', entity);
    }
    else if (entityName === 'notes') {
        await runAttachedRelations(entity, 'runOnNoteChange', entity);
    }
});

eventService.subscribe(eventService.ENTITY_CREATED, async ({ entityName, entity }) => {
    if (entityName === 'attributes') {
        await runAttachedRelations(await entity.getNote(), 'runOnAttributeCreation', entity);
    }
    else if (entityName === 'notes') {
        await runAttachedRelations(entity, 'runOnNoteCreation', entity);
    }
});

eventService.subscribe(eventService.CHILD_NOTE_CREATED, async ({ parentNote, childNote }) => {
    await runAttachedRelations(parentNote, 'runOnChildNoteCreation', childNote);
});