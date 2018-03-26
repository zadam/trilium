//import messagingService from './messaging.js';
//import ScriptContext from './script_context.js';

function reloadApp() {
    window.location.reload(true);
}

function showMessage(message) {
    console.log(now(), "message: ", message);

    $.notify({
        // options
        message: message
    }, {
        // settings
        type: 'success',
        delay: 3000
    });
}

function showError(message, delay = 10000) {
    console.log(now(), "error: ", message);

    $.notify({
        // options
        message: message
    }, {
        // settings
        type: 'danger',
        delay: delay
    });
}

function throwError(message) {
    messagingService.logError(message);

    throw new Error(message);
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

function formatDate(date) {
    return padNum(date.getDate()) + ". " + padNum(date.getMonth() + 1) + ". " + date.getFullYear();
}

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
    return window && window.process && window.process.type;
}

function assertArguments() {
    for (const i in arguments) {
        if (!arguments[i]) {
            throwError(`Argument idx#${i} should not be falsy: ${arguments[i]}`);
        }
    }
}

function assert(expr, message) {
    if (!expr) {
        throwError(message);
    }
}

function isTopLevelNode(node) {
    return isRootNode(node.getParent());
}

function isRootNode(node) {
    return node.key === "root_1";
}

function escapeHtml(str) {
    return $('<div/>').text(str).html();
}

async function stopWatch(what, func) {
    const start = new Date();

    const ret = await func();

    const tookMs = new Date().getTime() - start.getTime();

    console.log(`${what} took ${tookMs}ms`);

    return ret;
}

async function executeBundle(bundle) {
    const apiContext = ScriptContext(bundle.note, bundle.allNotes);

    return await (function () {
        return eval(`const apiContext = this; (async function() { ${bundle.script}\r\n})()`);
    }.call(apiContext));
}

function formatValueWithWhitespace(val) {
    return /[^\w_-]/.test(val) ? '"' + val + '"' : val;
}

function formatLabel(attr) {
    let str = "@" + formatValueWithWhitespace(attr.name);

    if (attr.value !== "") {
        str += "=" + formatValueWithWhitespace(attr.value);
    }

    return str;
}

const CKEDITOR = {"js": ["libraries/ckeditor/ckeditor.js"]};

const CODE_MIRROR = {
    js: [
        "libraries/codemirror/codemirror.js",
        "libraries/codemirror/addon/mode/loadmode.js",
        "libraries/codemirror/addon/fold/xml-fold.js",
        "libraries/codemirror/addon/edit/matchbrackets.js",
        "libraries/codemirror/addon/edit/matchtags.js",
        "libraries/codemirror/addon/search/match-highlighter.js",
        "libraries/codemirror/mode/meta.js",
        "libraries/codemirror/addon/lint/lint.js",
        "libraries/codemirror/addon/lint/eslint.js"
    ],
    css: [
        "libraries/codemirror/codemirror.css",
        "libraries/codemirror/addon/lint/lint.css"
    ]
};

const ESLINT = {js: ["libraries/eslint.js"]};

async function requireLibrary(library) {
    if (library.css) {
        library.css.map(cssUrl => requireCss(cssUrl));
    }

    if (library.js) {
        for (const scriptUrl of library.js) {
            await requireScript(scriptUrl);
        }
    }
}

const dynamicallyLoadedScripts = [];

async function requireScript(url) {
    if (!dynamicallyLoadedScripts.includes(url)) {
        dynamicallyLoadedScripts.push(url);

        return await $.ajax({
            url: url,
            dataType: "script",
            cache: true
        })
    }
}

async function requireCss(url) {
    const css = Array
        .from(document.querySelectorAll('link'))
        .map(scr => scr.href);

    if (!css.includes(url)) {
        $('head').append($('<link rel="stylesheet" type="text/css" />').attr('href', url));
    }
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
        const ret = fn(item);

        obj[ret[0]] = ret[1];
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
    $(document).bind('keydown', keyboardShortcut, e => {
        handler();

        e.preventDefault();
    });
}

export default {
    reloadApp,
    showMessage,
    showError,
    throwError,
    parseDate,
    padNum,
    formatTime,
    formatTimeWithSeconds,
    formatDate,
    formatDateISO,
    formatDateTime,
    now,
    isElectron,
    assertArguments,
    assert,
    isTopLevelNode,
    isRootNode,
    escapeHtml,
    stopWatch,
    executeBundle,
    formatValueWithWhitespace,
    formatLabel,
    requireLibrary,
    CKEDITOR,
    CODE_MIRROR,
    ESLINT,
    getHost,
    download,
    toObject,
    randomString,
    bindShortcut
};