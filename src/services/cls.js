const clsHooked = require('cls-hooked');
const namespace = clsHooked.createNamespace("trilium");

async function init(callback) {
    return await namespace.runAndReturn(callback);
}

function wrap(callback) {
    return async () => await init(callback);
}

function getSourceId() {
    return namespace.get('sourceId');
}

function disableEntityEvents() {
    namespace.set('disableEntityEvents', true);
}

function isEntityEventsDisabled() {
    return !!namespace.get('disableEntityEvents');
}

function reset() {
    clsHooked.reset();
}

module.exports = {
    init,
    wrap,
    namespace,
    getSourceId,
    disableEntityEvents,
    isEntityEventsDisabled,
    reset
};