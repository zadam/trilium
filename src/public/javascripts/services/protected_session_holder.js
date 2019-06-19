import utils from "./utils.js";
import optionsInitService from './options_init.js';

const PROTECTED_SESSION_ID_KEY = 'protectedSessionId';

let lastProtectedSessionOperationDate = null;
let protectedSessionTimeout = null;

optionsInitService.addLoadListener(options => setProtectedSessionTimeout(options.protectedSessionTimeout));

setInterval(() => {
    if (lastProtectedSessionOperationDate !== null && Date.now() - lastProtectedSessionOperationDate.getTime() > protectedSessionTimeout * 1000) {
        resetProtectedSession();
    }
}, 5000);

function setProtectedSessionTimeout(encSessTimeout) {
    protectedSessionTimeout = encSessTimeout;
}

function setProtectedSessionId(id) {
    // using session cookie so that it disappears after browser/tab is closed
    utils.setSessionCookie(PROTECTED_SESSION_ID_KEY, id);
}

function resetProtectedSession() {
    utils.setSessionCookie(PROTECTED_SESSION_ID_KEY, null);

    // most secure solution - guarantees nothing remained in memory
    // since this expires because user doesn't use the app, it shouldn't be disruptive
    utils.reloadApp();
}

function isProtectedSessionAvailable() {
    return !!utils.getCookie(PROTECTED_SESSION_ID_KEY);
}

function touchProtectedSession() {
    if (isProtectedSessionAvailable()) {
        lastProtectedSessionOperationDate = new Date();

        setProtectedSessionId(utils.getCookie(PROTECTED_SESSION_ID_KEY));
    }
}

export default {
    setProtectedSessionId,
    resetProtectedSession,
    isProtectedSessionAvailable,
    setProtectedSessionTimeout,
    touchProtectedSession
};