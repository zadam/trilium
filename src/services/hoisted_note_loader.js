const optionService = require('./options');
const sqlInit = require('./sql_init');
const eventService = require('./events');
const hoistedNote = require('./hoisted_note');

eventService.subscribe(eventService.ENTITY_CHANGED, ({entityName, entity}) => {
    if (entityName === 'options' && entity.name === 'hoistedNoteId') {
        hoistedNote.setHoistedNoteId(entity.value);
    }
});

hoistedNote.setHoistedNoteId(optionService.getOption('hoistedNoteId'));
