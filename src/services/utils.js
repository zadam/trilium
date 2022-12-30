"use strict";

const crypto = require('crypto');
const randtoken = require('rand-token').generator({source: 'crypto'});
const unescape = require('unescape');
const escape = require('escape-html');
const sanitize = require("sanitize-filename");
const mimeTypes = require('mime-types');
const path = require('path');
const log = require('./log');

function newEntityId() {
    return randomString(12);
}

function randomString(length) {
    return randtoken.generate(length);
}

function randomSecureToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64');
}

function md5(content) {
    return crypto.createHash('md5').update(content).digest('hex');
}

function toBase64(plainText) {
    return Buffer.from(plainText).toString('base64');
}

function fromBase64(encodedText) {
    return Buffer.from(encodedText, 'base64');
}

function hmac(secret, value) {
    const hmac = crypto.createHmac('sha256', Buffer.from(secret.toString(), 'ASCII'));
    hmac.update(value.toString());
    return hmac.digest('base64');
}

function isElectron() {
    return !!process.versions['electron'];
}

function hash(text) {
    return crypto.createHash('sha1').update(text).digest('base64');
}

function isEmptyOrWhitespace(str) {
    return str === null || str.match(/^ *$/) !== null;
}

function sanitizeSqlIdentifier(str) {
    return str.replace(/[^A-Za-z0-9_]/g, "");
}

function prepareSqlForLike(prefix, str, suffix) {
    const value = str
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "''")
        .replace(/_/g, "\\_")
        .replace(/%/g, "\\%");

    return `'${prefix}${value}${suffix}' ESCAPE '\\'`;
}

function stopWatch(what, func, timeLimit = 0) {
    const start = Date.now();

    const ret = func();

    const tookMs = Date.now() - start;

    if (tookMs >= timeLimit) {
        log.info(`${what} took ${tookMs}ms`);
    }

    return ret;
}

function escapeHtml(str) {
    return escape(str);
}

function unescapeHtml(str) {
    return unescape(str);
}

function toObject(array, fn) {
    const obj = {};

    for (const item of array) {
        const ret = fn(item);

        obj[ret[0]] = ret[1];
    }

    return obj;
}

function stripTags(text) {
    return text.replace(/<(?:.|\n)*?>/gm, '');
}

function intersection(a, b) {
    return a.filter(value => b.indexOf(value) !== -1);
}

function union(a, b) {
    const obj = {};

    for (let i = a.length-1; i >= 0; i--) {
        obj[a[i]] = a[i];
    }

    for (let i = b.length-1; i >= 0; i--) {
        obj[b[i]] = b[i];
    }

    const res = [];

    for (const k in obj) {
        if (obj.hasOwnProperty(k)) { // <-- optional
            res.push(obj[k]);
        }
    }

    return res;
}

function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function crash() {
    if (isElectron()) {
        require('electron').app.exit(1);
    }
    else {
        process.exit(1);
    }
}

function sanitizeFilenameForHeader(filename) {
    let sanitizedFilename = sanitize(filename);

    if (sanitizedFilename.trim().length === 0) {
        sanitizedFilename = "file";
    }

    return encodeURIComponent(sanitizedFilename)
}

function getContentDisposition(filename) {
    const sanitizedFilename = sanitizeFilenameForHeader(filename);

    return `file; filename="${sanitizedFilename}"; filename*=UTF-8''${sanitizedFilename}`;
}

const STRING_MIME_TYPES = [
    "application/javascript",
    "application/x-javascript",
    "application/json",
    "application/x-sql",
    "image/svg+xml"
];

function isStringNote(type, mime) {
    // render and book are string note in the sense that they are expected to contain empty string
    return ["text", "code", "relationMap", "search", "render", "book", "mermaid", "canvas"].includes(type)
        || mime.startsWith('text/')
        || STRING_MIME_TYPES.includes(mime);
}

function quoteRegex(url) {
    return url.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
}

function replaceAll(string, replaceWhat, replaceWith) {
    const quotedReplaceWhat = quoteRegex(replaceWhat);

    return string.replace(new RegExp(quotedReplaceWhat, "g"), replaceWith);
}

function formatDownloadTitle(filename, type, mime) {
    if (!filename) {
        filename = "untitled";
    }

    filename = sanitize(filename);

    if (type === 'text') {
        return `${filename}.html`;
    } else if (['relationMap', 'canvas', 'search'].includes(type)) {
        return `${filename}.json`;
    } else {
        if (!mime) {
            return filename;
        }

        mime = mime.toLowerCase();
        const filenameLc = filename.toLowerCase();
        const extensions = mimeTypes.extensions[mime];

        if (!extensions || extensions.length === 0) {
            return filename;
        }

        for (const ext of extensions) {
            if (filenameLc.endsWith(`.${ext}`)) {
                return filename;
            }
        }

        if (mime === 'application/octet-stream') {
            // we didn't find any good guess for this one, it will be better to just return
            // the current name without fake extension. It's possible that the title still preserves to correct
            // extension too

            return filename;
        }

        return `${filename}.${extensions[0]}`;
    }
}

function removeTextFileExtension(filePath) {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === '.md' || extension === '.markdown' || extension === '.html') {
        return filePath.substr(0, filePath.length - extension.length);
    }
    else {
        return filePath;
    }
}

function getNoteTitle(filePath, replaceUnderscoresWithSpaces, noteMeta) {
    if (noteMeta) {
        return noteMeta.title;
    } else {
        const basename = path.basename(removeTextFileExtension(filePath));
        if (replaceUnderscoresWithSpaces) {
            return basename.replace(/_/g, ' ').trim();
        }
        return basename;
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
        })
            .catch(error => rej(error));

        setTimeout(() => {
            if (!resolved) {
                rej(error);
            }
        }, limitMs);
    });
}

function deferred() {
    return (() => {
        let resolve, reject;

        let promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });

        promise.resolve = resolve;
        promise.reject = reject;

        return promise;
    })();
}

function removeDiacritic(str) {
    if (!str) {
        return "";
    }

    return str.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalize(str) {
    return removeDiacritic(str).toLowerCase();
}

function filterAttributeName(name) {
    return name.replace(/[^\p{L}\p{N}_:]/ug, "");
}

module.exports = {
    randomSecureToken,
    randomString,
    md5,
    newEntityId,
    toBase64,
    fromBase64,
    hmac,
    isElectron,
    hash,
    isEmptyOrWhitespace,
    sanitizeSqlIdentifier,
    prepareSqlForLike,
    stopWatch,
    escapeHtml,
    unescapeHtml,
    toObject,
    stripTags,
    intersection,
    union,
    escapeRegExp,
    crash,
    sanitizeFilenameForHeader,
    getContentDisposition,
    isStringNote,
    quoteRegex,
    replaceAll,
    getNoteTitle,
    removeTextFileExtension,
    formatDownloadTitle,
    timeLimit,
    deferred,
    removeDiacritic,
    normalize,
    filterAttributeName
};
