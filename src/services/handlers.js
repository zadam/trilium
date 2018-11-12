const eventService = require('./events');
const scriptService = require('./script');
const treeService = require('./tree');
const messagingService = require('./messaging');
const log = require('./log');
const Attribute = require('../entities/attribute');

async function runAttachedRelations(note, relationName, originEntity) {
    const runRelations = await note.getRelations(relationName);

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

async function processMirrorRelations(entityName, entity, handler) {
    if (entityName === 'attributes' && entity.type === 'relation') {
        const note = await entity.getNote();
        const attributes = (await note.getAttributes(entity.name)).filter(relation => relation.type === 'relation-definition');

        for (const attribute of attributes) {
            const definition = attribute.value;

            if (definition.mirrorRelation && definition.mirrorRelation.trim()) {
                const targetNote = await entity.getTargetNote();

                await handler(definition, note, targetNote);
            }
        }
    }
}

eventService.subscribe(eventService.ENTITY_CHANGED, async ({ entityName, entity }) => {
    await processMirrorRelations(entityName, entity, async (definition, note, targetNote) => {
        // we need to make sure that also target's mirror attribute exists and if note, then create it
        if (!await targetNote.hasRelation(definition.mirrorRelation)) {
            await new Attribute({
                noteId: targetNote.noteId,
                type: 'relation',
                name: definition.mirrorRelation,
                value: note.noteId,
                isInheritable: entity.isInheritable
            }).save();

            targetNote.invalidateAttributeCache();
        }
    });
});

eventService.subscribe(eventService.ENTITY_DELETED, async ({ entityName, entity }) => {
    await processMirrorRelations(entityName, entity, async (definition, note, targetNote) => {
        // if one mirror attribute is deleted then the other should be deleted as well
        const relations = await targetNote.getRelations(definition.mirrorRelation);

        for (const relation of relations) {
            relation.isDeleted = true;
            await relation.save();
        }

        if (relations.length > 0) {
            targetNote.invalidateAttributeCache();
        }
    });
});