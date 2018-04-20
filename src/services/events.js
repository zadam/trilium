const ENTER_PROTECTED_SESSION = "ENTER_PROTECTED_SESSION";
const ENTITY_CHANGED = "ENTITY_CHANGED";

const eventListeners = {};

function subscribe(eventType, listener) {
    eventListeners[eventType] = eventListeners[eventType] || [];
    eventListeners[eventType].push(listener);
}

function emit(eventType, data) {
    const listeners = eventListeners[eventType];

    if (listeners) {
        for (const listener of listeners) {
            // not awaiting for async processing
            listener(data);
        }
    }
}

module.exports = {
    subscribe,
    emit,
    // event types:
    ENTER_PROTECTED_SESSION,
    ENTITY_CHANGED
};