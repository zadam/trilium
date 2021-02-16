const clsHooked = require('cls-hooked');
const namespace = clsHooked.createNamespace("trilium");

function init(callback) {
    return namespace.runAndReturn(callback);
}

function wrap(callback) {
    return () => {
        try {
            init(callback);
        }
        catch (e) {
            console.log(`Error occurred: ${e.message}: ${e.stack}`);
        }
    }
}

function get(key) {
    return namespace.get(key);
}

function set(key, value) {
    namespace.set(key, value);
}

function getHoistedNoteId() {
    return namespace.get('hoistedNoteId') || 'root';
}

function getSourceId() {
    return namespace.get('sourceId');
}

function getLocalNowDateTime() {
    return namespace.get('localNowDateTime');
}

function disableEntityEvents() {
    namespace.set('disableEntityEvents', true);
}

function isEntityEventsDisabled() {
    return !!namespace.get('disableEntityEvents');
}

function getAndClearEntityChanges() {
    const entityChanges = namespace.get('entityChanges') || [];

    namespace.set('entityChanges', []);

    return entityChanges;
}

function addEntityChange(entityChange) {
    if (namespace.get('ignoreEntityChanges')) {
        return;
    }

    const entityChanges = namespace.get('entityChanges') || [];

    entityChanges.push(entityChange);

    namespace.set('entityChanges', entityChanges);
}

function reset() {
    clsHooked.reset();
}

function getEntityFromCache(entityName, entityId) {
    return namespace.get(entityName + '-' + entityId);
}

function setEntityToCache(entityName, entityId, entity) {
    namespace.set(entityName + '-' + entityId, entity);
}

function ignoreEntityChanges() {
    namespace.set('ignoreEntityChanges', true);
}

module.exports = {
    init,
    wrap,
    get,
    set,
    namespace,
    getHoistedNoteId,
    getSourceId,
    getLocalNowDateTime,
    disableEntityEvents,
    isEntityEventsDisabled,
    reset,
    getAndClearEntityChanges,
    addEntityChange,
    getEntityFromCache,
    setEntityToCache,
    ignoreEntityChanges
};
