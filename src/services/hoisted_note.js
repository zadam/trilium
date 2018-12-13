const optionService = require('./options');
const sqlInit = require('./sql_init');
const eventService = require('./events');

let hoistedNoteId = 'root';

eventService.subscribe(eventService.ENTITY_CHANGED, async ({entityName, entity}) => {
    if (entityName === 'options' && entity.name === 'hoistedNoteId') {
        hoistedNoteId = entity.value;
    }
});

sqlInit.dbReady.then(async () => {
    hoistedNoteId = await optionService.getOption('hoistedNoteId');
});

module.exports = {
    getHoistedNoteId: () => hoistedNoteId
};