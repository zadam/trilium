import utils from "./utils.js";
import options from './options.js';
import server from "./server.js";

const PROTECTED_SESSION_ID_KEY = 'protectedSessionId';

let lastProtectedSessionOperationDate = 0;

setInterval(() => {
    const protectedSessionTimeout = options.getInt('protectedSessionTimeout');
    if (lastProtectedSessionOperationDate
        && Date.now() - lastProtectedSessionOperationDate > protectedSessionTimeout * 1000) {

        resetProtectedSession();
    }
}, 10000);

function setProtectedSessionId(id) {
    // using session cookie so that it disappears after browser/tab is closed
    utils.setSessionCookie(PROTECTED_SESSION_ID_KEY, id);
}

function resetSessionCookie() {
    utils.setSessionCookie(PROTECTED_SESSION_ID_KEY, null);
}

async function resetProtectedSession() {
    resetSessionCookie();

    await server.post("logout/protected");

    utils.reloadApp();
}

function isProtectedSessionAvailable() {
    return !!utils.getCookie(PROTECTED_SESSION_ID_KEY);
}

function touchProtectedSession() {
    if (isProtectedSessionAvailable()) {
        lastProtectedSessionOperationDate = Date.now();

        setProtectedSessionId(utils.getCookie(PROTECTED_SESSION_ID_KEY));
    }
}

function touchProtectedSessionIfNecessary(note) {
    if (note && note.isProtected && isProtectedSessionAvailable()) {
        touchProtectedSession();
    }
}

export default {
    setProtectedSessionId,
    resetSessionCookie,
    resetProtectedSession,
    isProtectedSessionAvailable,
    touchProtectedSession,
    touchProtectedSessionIfNecessary
};
