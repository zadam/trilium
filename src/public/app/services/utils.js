function reloadFrontendApp(reason) {
    if (reason) {
        logInfo("Frontend app reload: " + reason);
    }

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

function localNowDateTime() {
    return dayjs().format('YYYY-MM-DD HH:mm:ss.SSSZZ')
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

const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
};

function escapeHtml(str) {
    return str.replace(/[&<>"'`=\/]/g, s => entityMap[s]);
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
    let str = "#" + formatValueWithWhitespace(label.name);

    if (label.value !== "") {
        str += "=" + formatValueWithWhitespace(label.value);
    }

    return str;
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

function bindGlobalShortcut(keyboardShortcut, handler) {
    bindElShortcut($(document), keyboardShortcut, handler);
}

function bindElShortcut($el, keyboardShortcut, handler) {
    if (isDesktop()) {
        keyboardShortcut = normalizeShortcut(keyboardShortcut);

        $el.bind('keydown', keyboardShortcut, e => {
            handler(e);

            e.preventDefault();
            e.stopPropagation();
        });
    }
}

/**
 * Normalize to the form expected by the jquery.hotkeys.js
 */
function normalizeShortcut(shortcut) {
    return shortcut
        .toLowerCase()
        .replace("enter", "return")
        .replace("delete", "del")
        .replace("ctrl+alt", "alt+ctrl")
        .replace("meta+alt", "alt+meta"); // alt needs to be first;
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
    document.cookie = name + "=" + (value || "") + "; SameSite=Strict";
}

function getCookie(name) {
    const valueMatch = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return valueMatch ? valueMatch[2] : null;
}

function getNoteTypeClass(type) {
    return "type-" + type;
}

function getMimeTypeClass(mime) {
    if (!mime) {
        return "";
    }

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
        glob.activeDialog = null;
    }
}

let $lastFocusedElement = null;

// perhaps there should be saved focused element per tab?
function saveFocusedElement() {
    $lastFocusedElement = $(":focus");
}

function focusSavedElement() {
    if (!$lastFocusedElement) {
        return;
    }

    $lastFocusedElement.focus();
    $lastFocusedElement = null;
}

async function openDialog($dialog, closeActDialog = true) {
    if (closeActDialog) {
        closeActiveDialog();
        glob.activeDialog = $dialog;
    }

    saveFocusedElement();
-
    $dialog.modal();

    $dialog.on('hidden.bs.modal', () => {
        $(".aa-input").autocomplete("close");

        if (!glob.activeDialog || glob.activeDialog === $dialog) {
            focusSavedElement();
        }
    });

    const keyboardActionsService = (await import("./keyboard_actions.js")).default;
    keyboardActionsService.updateDisplayedShortcuts($dialog);
}

function isHtmlEmpty(html) {
    if (!html) {
        return true;
    }

    html = html.toLowerCase();

    return !html.includes('<img')
        && !html.includes('<section')
        // line below will actually attempt to load images so better to check for images first
        && $("<div>").html(html).text().trim().length === 0;
}

async function clearBrowserCache() {
    if (isElectron()) {
        const win = dynamicRequire('@electron/remote').getCurrentWindow();
        await win.webContents.session.clearCache();
    }
}

function copySelectionToClipboard() {
    const text = window.getSelection().toString();
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
    }
}

function dynamicRequire(moduleName) {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(moduleName);
    }
    else {
        return require(moduleName);
    }
}

function timeLimit(promise, limitMs, errorMessage) {
    if (!promise || !promise.then) { // it's not actually a promise
        return promise;
    }

    // better stack trace if created outside of promise
    const error = new Error(errorMessage || `Process exceeded time limit ${limitMs}`);

    return new Promise((res, rej) => {
        let resolved = false;

        promise.then(result => {
            resolved = true;

            res(result);
        });

        setTimeout(() => {
            if (!resolved) {
                rej(error);
            }
        }, limitMs);
    });
}

function initHelpDropdown($el) {
    // stop inside clicks from closing the menu
    const $dropdownMenu = $el.find('.help-dropdown .dropdown-menu');
    $dropdownMenu.on('click', e => e.stopPropagation());

    // previous propagation stop will also block help buttons from being opened so we need to re-init for this element
    initHelpButtons($dropdownMenu);
}

const wikiBaseUrl = "https://github.com/zadam/trilium/wiki/"

function openHelp(e) {
    window.open(wikiBaseUrl + $(e.target).attr("data-help-page"), '_blank');
}

function initHelpButtons($el) {
    $el.on("click", "*[data-help-page]", e => openHelp(e));
}

function filterAttributeName(name) {
    return name.replace(/[^\p{L}\p{N}_:]/ug, "");
}

const ATTR_NAME_MATCHER = new RegExp("^[\\p{L}\\p{N}_:]+$", "u");

function isValidAttributeName(name) {
    return ATTR_NAME_MATCHER.test(name);
}

function sleep(time_ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, time_ms);
    });
}

function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

export default {
    reloadFrontendApp,
    parseDate,
    padNum,
    formatTime,
    formatTimeWithSeconds,
    formatDate,
    formatDateISO,
    formatDateTime,
    localNowDateTime,
    now,
    isElectron,
    isMac,
    assertArguments,
    escapeHtml,
    stopWatch,
    formatLabel,
    toObject,
    randomString,
    bindGlobalShortcut,
    bindElShortcut,
    isMobile,
    isDesktop,
    setCookie,
    setSessionCookie,
    getCookie,
    getNoteTypeClass,
    getMimeTypeClass,
    closeActiveDialog,
    openDialog,
    saveFocusedElement,
    focusSavedElement,
    isHtmlEmpty,
    clearBrowserCache,
    normalizeShortcut,
    copySelectionToClipboard,
    dynamicRequire,
    timeLimit,
    initHelpDropdown,
    initHelpButtons,
    openHelp,
    filterAttributeName,
    isValidAttributeName,
    sleep,
    escapeRegExp
};
