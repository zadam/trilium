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

function getComponentId() {
    return namespace.get('componentId');
}

function getLocalNowDateTime() {
    return namespace.get('localNowDateTime');
}

function disableEntityEvents() {
    namespace.set('disableEntityEvents', true);
}

function enableEntityEvents() {
    namespace.set('disableEntityEvents', false);
}

function isEntityEventsDisabled() {
    return !!namespace.get('disableEntityEvents');
}

function setMigrationRunning(running) {
    namespace.set('migrationRunning', !!running);
}

function isMigrationRunning() {
    return !!namespace.get('migrationRunning');
}

function disableSlowQueryLogging(disable) {
    namespace.set('disableSlowQueryLogging', disable);
}

function isSlowQueryLoggingDisabled() {
    return !!namespace.get('disableSlowQueryLogging');
}

function getAndClearEntityChangeIds() {
    const entityChangeIds = namespace.get('entityChangeIds') || [];

    namespace.set('entityChangeIds', []);

    return entityChangeIds;
}

function putEntityChange(entityChange) {
    if (namespace.get('ignoreEntityChangeIds')) {
        return;
    }

    const entityChangeIds = namespace.get('entityChangeIds') || [];

    // store only ID since the record can be modified (e.g., in erase)
    entityChangeIds.push(entityChange.id);

    namespace.set('entityChangeIds', entityChangeIds);
}

function reset() {
    clsHooked.reset();
}

function ignoreEntityChangeIds() {
    namespace.set('ignoreEntityChangeIds', true);
}

module.exports = {
    init,
    wrap,
    get,
    set,
    namespace,
    getHoistedNoteId,
    getComponentId,
    getLocalNowDateTime,
    disableEntityEvents,
    enableEntityEvents,
    isEntityEventsDisabled,
    reset,
    getAndClearEntityChangeIds,
    putEntityChange,
    ignoreEntityChangeIds,
    disableSlowQueryLogging,
    isSlowQueryLoggingDisabled,
    setMigrationRunning,
    isMigrationRunning
};
