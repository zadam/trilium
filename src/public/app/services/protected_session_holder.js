import options from './options.js';
import server from "./server.js";

let lastProtectedSessionOperationDate = 0;

setInterval(() => {
    const protectedSessionTimeout = options.getInt('protectedSessionTimeout');
    if (lastProtectedSessionOperationDate
        && Date.now() - lastProtectedSessionOperationDate > protectedSessionTimeout * 1000) {

        resetProtectedSession();
    }
}, 10000);

function enableProtectedSession() {
    glob.isProtectedSessionAvailable = true;

    touchProtectedSession();
}

async function resetProtectedSession() {
    await server.post("logout/protected");
}

function isProtectedSessionAvailable() {
    return glob.isProtectedSessionAvailable;
}

function touchProtectedSession() {
    if (isProtectedSessionAvailable()) {
        lastProtectedSessionOperationDate = Date.now();
    }
}

function touchProtectedSessionIfNecessary(note) {
    if (note && note.isProtected && isProtectedSessionAvailable()) {
        touchProtectedSession();
    }
}

export default {
    enableProtectedSession,
    resetProtectedSession,
    isProtectedSessionAvailable,
    touchProtectedSession,
    touchProtectedSessionIfNecessary
};
