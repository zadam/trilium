function reloadApp() {
    window.location.reload(true);
}

function parseDate(str) {
    try {
        return new Date(Date.parse(str));
    }
    catch (e) {
        throw new Error("Can't parse date from " + str + ": " + e.stack);
    }
}

function padNum(num) {
    return (num <= 9 ? "0" : "") + num;
}

function formatTime(date) {
    return padNum(date.getHours()) + ":" + padNum(date.getMinutes());
}

function formatTimeWithSeconds(date) {
    return padNum(date.getHours()) + ":" + padNum(date.getMinutes()) + ":" + padNum(date.getSeconds());
}

// this is producing local time!
function formatDate(date) {
//    return padNum(date.getDate()) + ". " + padNum(date.getMonth() + 1) + ". " + date.getFullYear();
    // instead of european format we'll just use ISO as that's pretty unambiguous

    return formatDateISO(date);
}

// this is producing local time!
function formatDateISO(date) {
    return date.getFullYear() + "-" + padNum(date.getMonth() + 1) + "-" + padNum(date.getDate());
}

function formatDateTime(date) {
    return formatDate(date) + " " + formatTime(date);
}

function now() {
    return formatTimeWithSeconds(new Date());
}

function isElectron() {
    return !!(window && window.process && window.process.type);
}

function isMac() {
    return navigator.platform.indexOf('Mac') > -1;
}

function assertArguments() {
    for (const i in arguments) {
        if (!arguments[i]) {
            console.trace(`Argument idx#${i} should not be falsy: ${arguments[i]}`);
        }
    }
}

function escapeHtml(str) {
    return $('<div/>').text(str).html();
}

async function stopWatch(what, func) {
    const start = new Date();

    const ret = await func();

    const tookMs = Date.now() - start.getTime();

    console.log(`${what} took ${tookMs}ms`);

    return ret;
}

function formatValueWithWhitespace(val) {
    return /[^\w_-]/.test(val) ? '"' + val + '"' : val;
}

function formatLabel(label) {
    let str = "@" + formatValueWithWhitespace(label.name);

    if (label.value !== "") {
        str += "=" + formatValueWithWhitespace(label.value);
    }

    return str;
}

function getHost() {
    const url = new URL(window.location.href);
    return url.protocol + "//" + url.hostname + ":" + url.port;
}

function download(url) {
    if (isElectron()) {
        const remote = require('electron').remote;

        remote.getCurrentWebContents().downloadURL(url);
    }
    else {
        window.location.href = url;
    }
}

function toObject(array, fn) {
    const obj = {};

    for (const item of array) {
        const [key, value] = fn(item);

        obj[key] = value;
    }

    return obj;
}

function randomString(len) {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < len; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}

function bindShortcut(keyboardShortcut, handler) {
    bindElShortcut($(document), keyboardShortcut, handler);
}

function bindElShortcut($el, keyboardShortcut, handler) {
    if (isDesktop()) {
        if (isMac()) {
            // use CMD (meta) instead of CTRL for all shortcuts
            keyboardShortcut = keyboardShortcut.replace("ctrl", "meta");
        }

        $el.bind('keydown', keyboardShortcut, e => {
            handler();

            e.preventDefault();
        });
    }
}

function isMobile() {
    return window.device === "mobile"
        // window.device is not available in setup
        || (!window.device && /Mobi/.test(navigator.userAgent));
}

function isDesktop() {
    return window.device === "desktop"
        // window.device is not available in setup
        || (!window.device && !/Mobi/.test(navigator.userAgent));
}

// cookie code below works for simple use cases only - ASCII only
// not setting path so that cookies do not leak into other websites if multiplexed with reverse proxy

function setCookie(name, value) {
    const date = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000);
    const expires = "; expires=" + date.toUTCString();

    document.cookie = name + "=" + (value || "")  + expires + ";";
}

function setSessionCookie(name, value) {
    document.cookie = name + "=" + (value || "") + ";";
}

function getCookie(name) {
    const valueMatch = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return valueMatch ? valueMatch[2] : null;
}

function getNoteTypeClass(type) {
    return "type-" + type;
}

function getMimeTypeClass(mime) {
    const semicolonIdx = mime.indexOf(';');

    if (semicolonIdx !== -1) {
        // stripping everything following the semicolon
        mime = mime.substr(0, semicolonIdx);
    }

    return 'mime-' + mime.toLowerCase().replace(/[\W_]+/g,"-");
}

function closeActiveDialog() {
    if (glob.activeDialog) {
        glob.activeDialog.modal('hide');
    }
}

export default {
    reloadApp,
    parseDate,
    padNum,
    formatTime,
    formatTimeWithSeconds,
    formatDate,
    formatDateISO,
    formatDateTime,
    now,
    isElectron,
    isMac,
    assertArguments,
    escapeHtml,
    stopWatch,
    formatValueWithWhitespace,
    formatLabel,
    getHost,
    download,
    toObject,
    randomString,
    bindShortcut,
    bindElShortcut,
    isMobile,
    isDesktop,
    setCookie,
    setSessionCookie,
    getCookie,
    getNoteTypeClass,
    getMimeTypeClass,
    closeActiveDialog
};