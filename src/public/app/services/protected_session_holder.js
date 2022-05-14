import server from "./server.js";

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

async function touchProtectedSession() {
    if (isProtectedSessionAvailable()) {
        await server.post("login/protected/touch");
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
