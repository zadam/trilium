const NOTE_TITLE_CHANGED = "NOTE_TITLE_CHANGED";
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

async function syncEmit(eventType, data) {
    const listeners = eventListeners[eventType];

    if (listeners) {
        for (const listener of listeners) {
            await listener(data);
        }
    }
}

module.exports = {
    subscribe,
    emit,
    syncEmit,
    // event types:
    NOTE_TITLE_CHANGED,
    ENTER_PROTECTED_SESSION,
    ENTITY_CHANGED
};