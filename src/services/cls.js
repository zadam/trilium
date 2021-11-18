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

function getAndClearEntityChangeIds() {
    const entityChangeIds = namespace.get('entityChangeIds') || [];

    namespace.set('entityChangeIds', []);

    return entityChangeIds;
}

function addEntityChange(entityChange) {
    if (namespace.get('ignoreEntityChangeIds')) {
        return;
    }

    const entityChangeIds = namespace.get('entityChangeIds') || [];

    // store only ID since the record can be modified (e.g. in erase)
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
    getSourceId,
    getLocalNowDateTime,
    disableEntityEvents,
    isEntityEventsDisabled,
    reset,
    getAndClearEntityChangeIds,
    addEntityChange,
    ignoreEntityChangeIds
};
