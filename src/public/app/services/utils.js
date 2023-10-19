function reloadFrontendApp(reason) {
    if (reason) {
        logInfo(`Frontend app reload: ${reason}`);
    }

    window.location.reload();
}

function parseDate(str) {
    try {
        return new Date(Date.parse(str));
    }
    catch (e) {
        throw new Error(`Can't parse date from '${str}': ${e.message} ${e.stack}`);
    }
}

function padNum(num) {
    return `${num <= 9 ? "0" : ""}${num}`;
}

function formatTime(date) {
    return `${padNum(date.getHours())}:${padNum(date.getMinutes())}`;
}

function formatTimeWithSeconds(date) {
    return `${padNum(date.getHours())}:${padNum(date.getMinutes())}:${padNum(date.getSeconds())}`;
}

function formatTimeInterval(ms) {
    const seconds = Math.round(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const plural = (count, name) => `${count} ${name}${count > 1 ? 's' : ''}`;
    const segments = [];

    if (days > 0) {
        segments.push(plural(days, 'day'));
    }

    if (days < 2) {
        if (hours % 24 > 0) {
            segments.push(plural(hours % 24, 'hour'));
        }

        if (hours < 4) {
            if (minutes % 60 > 0) {
                segments.push(plural(minutes % 60, 'minute'));
            }

            if (minutes < 5) {
                if (seconds % 60 > 0) {
                    segments.push(plural(seconds % 60, 'second'));
                }
            }
        }
    }

    return segments.join(", ");
}

// this is producing local time!
function formatDate(date) {
    //    return padNum(date.getDate()) + ". " + padNum(date.getMonth() + 1) + ". " + date.getFullYear();
    // instead of european format we'll just use ISO as that's pretty unambiguous

    return formatDateISO(date);
}

// this is producing local time!
function formatDateISO(date) {
    return `${date.getFullYear()}-${padNum(date.getMonth() + 1)}-${padNum(date.getDate())}`;
}

function formatDateTime(date) {
    return `${formatDate(date)} ${formatTime(date)}`;
}

function localNowDateTime() {
    return dayjs().format('YYYY-MM-DD HH:mm:ss.SSSZZ');
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

function isCtrlKey(evt) {
    return (!isMac() && evt.ctrlKey)
        || (isMac() && evt.metaKey);
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

function formatSize(size) {
    size = Math.max(Math.round(size / 1024), 1);

    if (size < 1024) {
        return `${size} KiB`;
    }
    else {
        return `${Math.round(size / 102.4) / 10} MiB`;
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

function isMobile() {
    return window.glob?.device === "mobile"
        // window.glob.device is not available in setup
        || (!window.glob?.device && /Mobi/.test(navigator.userAgent));
}

function isDesktop() {
    return window.glob?.device === "desktop"
        // window.glob.device is not available in setup
        || (!window.glob?.device && !/Mobi/.test(navigator.userAgent));
}

// the cookie code below works for simple use cases only - ASCII only
// not setting a path so that cookies do not leak into other websites if multiplexed with reverse proxy

function setCookie(name, value) {
    const date = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000);
    const expires = `; expires=${date.toUTCString()}`;

    document.cookie = `${name}=${value || ""}${expires};`;
}

function getNoteTypeClass(type) {
    return `type-${type}`;
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

    return `mime-${mime.toLowerCase().replace(/[\W_]+/g, "-")}`;
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

    if ($lastFocusedElement.hasClass("ck")) {
        // must handle CKEditor separately because of this bug: https://github.com/ckeditor/ckeditor5/issues/607
        // the bug manifests itself in resetting the cursor position to the first character - jumping above

        const editor = $lastFocusedElement
            .closest('.ck-editor__editable')
            .prop('ckeditorInstance');

        if (editor) {
            editor.editing.view.focus();
        } else {
            console.log("Could not find CKEditor instance to focus last element");
        }
    } else {
        $lastFocusedElement.focus();
    }

    $lastFocusedElement = null;
}

async function openDialog($dialog, closeActDialog = true) {
    if (closeActDialog) {
        closeActiveDialog();
        glob.activeDialog = $dialog;
    }

    saveFocusedElement();

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
    } else if (typeof html !== 'string') {
        logError(`Got object of type '${typeof html}' where string was expected.`);
        return false;
    }

    html = html.toLowerCase();

    return !html.includes('<img')
        && !html.includes('<section')
        // the line below will actually attempt to load images so better to check for images first
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

    // previous propagation stop will also block help buttons from being opened, so we need to re-init for this element
    initHelpButtons($dropdownMenu);
}

const wikiBaseUrl = "https://github.com/zadam/trilium/wiki/";

function openHelp($button) {
    const helpPage = $button.attr("data-help-page");

    if (helpPage) {
        const url = wikiBaseUrl + helpPage;

        window.open(url, '_blank');
    }
}

function initHelpButtons($el) {
    // for some reason, the .on(event, listener, handler) does not work here (e.g. Options -> Sync -> Help button)
    // so we do it manually
    $el.on("click", e => {
        const $helpButton = $(e.target).closest("[data-help-page]");
        openHelp($helpButton);
    });
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

function areObjectsEqual () {
    let i, l, leftChain, rightChain;

    function compare2Objects (x, y) {
        let p;

        // remember that NaN === NaN returns false
        // and isNaN(undefined) returns true
        if (isNaN(x) && isNaN(y) && typeof x === 'number' && typeof y === 'number') {
            return true;
        }

        // Compare primitives and functions.
        // Check if both arguments link to the same object.
        // Especially useful on the step where we compare prototypes
        if (x === y) {
            return true;
        }

        // Works in case when functions are created in constructor.
        // Comparing dates is a common scenario. Another built-ins?
        // We can even handle functions passed across iframes
        if ((typeof x === 'function' && typeof y === 'function') ||
            (x instanceof Date && y instanceof Date) ||
            (x instanceof RegExp && y instanceof RegExp) ||
            (x instanceof String && y instanceof String) ||
            (x instanceof Number && y instanceof Number)) {
            return x.toString() === y.toString();
        }

        // At last, checking prototypes as good as we can
        if (!(x instanceof Object && y instanceof Object)) {
            return false;
        }

        if (x.isPrototypeOf(y) || y.isPrototypeOf(x)) {
            return false;
        }

        if (x.constructor !== y.constructor) {
            return false;
        }

        if (x.prototype !== y.prototype) {
            return false;
        }

        // Check for infinitive linking loops
        if (leftChain.indexOf(x) > -1 || rightChain.indexOf(y) > -1) {
            return false;
        }

        // Quick checking of one object being a subset of another.
        // todo: cache the structure of arguments[0] for performance
        for (p in y) {
            if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
                return false;
            }
            else if (typeof y[p] !== typeof x[p]) {
                return false;
            }
        }

        for (p in x) {
            if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
                return false;
            }
            else if (typeof y[p] !== typeof x[p]) {
                return false;
            }

            switch (typeof (x[p])) {
                case 'object':
                case 'function':

                    leftChain.push(x);
                    rightChain.push(y);

                    if (!compare2Objects (x[p], y[p])) {
                        return false;
                    }

                    leftChain.pop();
                    rightChain.pop();
                    break;

                default:
                    if (x[p] !== y[p]) {
                        return false;
                    }
                    break;
            }
        }

        return true;
    }

    if (arguments.length < 1) {
        return true; //Die silently? Don't know how to handle such case, please help...
        // throw "Need two or more arguments to compare";
    }

    for (i = 1, l = arguments.length; i < l; i++) {

        leftChain = []; //Todo: this can be cached
        rightChain = [];

        if (!compare2Objects(arguments[0], arguments[i])) {
            return false;
        }
    }

    return true;
}

function copyHtmlToClipboard(content) {
    const clipboardItem = new ClipboardItem({
        'text/html': new Blob([content], {type: 'text/html'}),
        'text/plain': new Blob([content], {type: 'text/plain'})
    });

    navigator.clipboard.write([clipboardItem]);
}

/**
 * @param {FNote} note
 * @return {string}
 */
function createImageSrcUrl(note) {
    return `api/images/${note.noteId}/${encodeURIComponent(note.title)}?timestamp=${Date.now()}`;
}

export default {
    reloadFrontendApp,
    parseDate,
    formatDateISO,
    formatDateTime,
    formatTimeInterval,
    formatSize,
    localNowDateTime,
    now,
    isElectron,
    isMac,
    isCtrlKey,
    assertArguments,
    escapeHtml,
    toObject,
    randomString,
    isMobile,
    isDesktop,
    setCookie,
    getNoteTypeClass,
    getMimeTypeClass,
    closeActiveDialog,
    openDialog,
    saveFocusedElement,
    focusSavedElement,
    isHtmlEmpty,
    clearBrowserCache,
    copySelectionToClipboard,
    dynamicRequire,
    timeLimit,
    initHelpDropdown,
    initHelpButtons,
    openHelp,
    filterAttributeName,
    isValidAttributeName,
    sleep,
    escapeRegExp,
    areObjectsEqual,
    copyHtmlToClipboard,
    createImageSrcUrl
};
