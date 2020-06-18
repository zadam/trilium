const clsHooked = require('cls-hooked');
const namespace = clsHooked.createNamespace("trilium");

async function init(callback) {
    return await namespace.runAndReturn(callback);
}

function wrap(callback) {
    return async () => await init(callback);
}

function get(key) {
    return namespace.get(key);
}

function set(key, value) {
    namespace.set(key, value);
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

function getSyncRows() {
    return namespace.get('syncRows') || [];
}

function addSyncRow(syncRow) {
    const syncRows = getSyncRows();

    syncRows.push(syncRow);

    namespace.set('syncRows', syncRows);
}

function reset() {
    clsHooked.reset();
}

function getEntityFromCache(entityName, entityId) {
    return namespace.get(entityName + '-' + entityId);
}

function setEntityToCache(entityName, entityId, entity) {
    return namespace.set(entityName + '-' + entityId, entity);
}

module.exports = {
    init,
    wrap,
    get,
    set,
    namespace,
    getSourceId,
    getLocalNowDateTime,
    disableEntityEvents,
    isEntityEventsDisabled,
    reset,
    getSyncRows,
    addSyncRow,
    getEntityFromCache,
    setEntityToCache
};
