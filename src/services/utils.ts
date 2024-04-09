"use strict";

import crypto = require('crypto');
const randtoken = require('rand-token').generator({source: 'crypto'});
import unescape = require('unescape');
import escape = require('escape-html');
import sanitize = require("sanitize-filename");
import mimeTypes = require('mime-types');
import path = require('path');

function newEntityId() {
    return randomString(12);
}

function randomString(length: number): string {
    return randtoken.generate(length);
}

function randomSecureToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64');
}

function md5(content: crypto.BinaryLike) {
    return crypto.createHash('md5').update(content).digest('hex');
}

function hashedBlobId(content: string | Buffer) {
    if (content === null || content === undefined) {
        content = "";
    }

    // sha512 is faster than sha256
    const base64Hash = crypto.createHash('sha512').update(content).digest('base64');

    // we don't want such + and / in the IDs
    const kindaBase62Hash = base64Hash
        .replaceAll('+', 'X')
        .replaceAll('/', 'Y');

    // 20 characters of base62 gives us ~120 bit of entropy which is plenty enough
    return kindaBase62Hash.substr(0, 20);
}

function toBase64(plainText: string | Buffer) {
    return Buffer.from(plainText).toString('base64');
}

function fromBase64(encodedText: string) {
    return Buffer.from(encodedText, 'base64');
}

function hmac(secret: any, value: any) {
    const hmac = crypto.createHmac('sha256', Buffer.from(secret.toString(), 'ascii'));
    hmac.update(value.toString());
    return hmac.digest('base64');
}

function isElectron() {
    return !!process.versions['electron'];
}

function hash(text: string) {
    text = text.normalize();

    return crypto.createHash('sha1').update(text).digest('base64');
}

function isEmptyOrWhitespace(str: string) {
    return str === null || str.match(/^ *$/) !== null;
}

function sanitizeSqlIdentifier(str: string) {
    return str.replace(/[^A-Za-z0-9_]/g, "");
}

function escapeHtml(str: string) {
    return escape(str);
}

function unescapeHtml(str: string) {
    return unescape(str);
}

function toObject<T, K extends string | number | symbol, V>(array: T[], fn: (item: T) => [K, V]): Record<K, V> {
    const obj: Record<K, V> = {} as Record<K, V>; // TODO: unsafe?

    for (const item of array) {
        const ret = fn(item);

        obj[ret[0]] = ret[1];
    }

    return obj;
}

function stripTags(text: string) {
    return text.replace(/<(?:.|\n)*?>/gm, '');
}

function union<T extends string | number | symbol>(a: T[], b: T[]): T[] {
    const obj: Record<T, T> = {} as Record<T, T>; // TODO: unsafe?

    for (let i = a.length-1; i >= 0; i--) {
        obj[a[i]] = a[i];
    }

    for (let i = b.length-1; i >= 0; i--) {
        obj[b[i]] = b[i];
    }

    const res: T[] = [];

    for (const k in obj) {
        if (obj.hasOwnProperty(k)) { // <-- optional
            res.push(obj[k]);
        }
    }

    return res;
}

function escapeRegExp(str: string) {
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

function sanitizeFilenameForHeader(filename: string) {
    let sanitizedFilename = sanitize(filename);

    if (sanitizedFilename.trim().length === 0) {
        sanitizedFilename = "file";
    }

    return encodeURIComponent(sanitizedFilename);
}

function getContentDisposition(filename: string) {
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

function isStringNote(type: string | null, mime: string) {
    // render and book are string note in the sense that they are expected to contain empty string
    return (type && ["text", "code", "relationMap", "search", "render", "book", "mermaid", "canvas"].includes(type))
        || mime.startsWith('text/')
        || STRING_MIME_TYPES.includes(mime);
}

function quoteRegex(url: string) {
    return url.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
}

function replaceAll(string: string, replaceWhat: string, replaceWith: string) {
    const quotedReplaceWhat = quoteRegex(replaceWhat);

    return string.replace(new RegExp(quotedReplaceWhat, "g"), replaceWith);
}

function formatDownloadTitle(fileName: string, type: string, mime: string) {
    if (!fileName) {
        fileName = "untitled";
    }

    fileName = sanitize(fileName);

    if (type === 'text') {
        return `${fileName}.html`;
    } else if (['relationMap', 'canvas', 'search'].includes(type)) {
        return `${fileName}.json`;
    } else {
        if (!mime) {
            return fileName;
        }

        mime = mime.toLowerCase();
        const filenameLc = fileName.toLowerCase();
        const extensions = mimeTypes.extensions[mime];

        if (!extensions || extensions.length === 0) {
            return fileName;
        }

        for (const ext of extensions) {
            if (filenameLc.endsWith(`.${ext}`)) {
                return fileName;
            }
        }

        if (mime === 'application/octet-stream') {
            // we didn't find any good guess for this one, it will be better to just return
            // the current name without a fake extension. It's possible that the title still preserves the correct
            // extension too

            return fileName;
        }

        return `${fileName}.${extensions[0]}`;
    }
}

function removeTextFileExtension(filePath: string) {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === '.md' || extension === '.markdown' || extension === '.html') {
        return filePath.substr(0, filePath.length - extension.length);
    }
    else {
        return filePath;
    }
}

function getNoteTitle(filePath: string, replaceUnderscoresWithSpaces: boolean, noteMeta?: { title?: string }) {
    if (noteMeta?.title) {
        return noteMeta.title;
    } else {
        const basename = path.basename(removeTextFileExtension(filePath));
        if (replaceUnderscoresWithSpaces) {
            return basename.replace(/_/g, ' ').trim();
        }
        return basename;
    }
}

function timeLimit<T>(promise: Promise<T>, limitMs: number, errorMessage?: string): Promise<T> {
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

interface DeferredPromise<T> extends Promise<T> {
	resolve: (value: T | PromiseLike<T>) => void,
	reject: (reason?: any) => void
}

function deferred<T>(): DeferredPromise<T> {
    return (() => {
        let resolve!: (value: T | PromiseLike<T>) => void;
		let reject!: (reason?: any) => void;

        let promise = new Promise<T>((res, rej) => {
            resolve = res;
            reject = rej;
        }) as DeferredPromise<T>;

        promise.resolve = resolve;
        promise.reject = reject;
        return promise as DeferredPromise<T>;
    })();
}

function removeDiacritic(str: string) {
    if (!str) {
        return "";
    }
    str = str.toString();
    return str.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalize(str: string) {
    return removeDiacritic(str).toLowerCase();
}

function toMap<T extends Record<string, any>>(list: T[], key: keyof T): Record<string, T> {
    const map: Record<string, T> = {};

    for (const el of list) {
        map[el[key]] = el;
    }

    return map;
}

function isString(x: any) {
    return Object.prototype.toString.call(x) === "[object String]";
}

export = {
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
    escapeHtml,
    unescapeHtml,
    toObject,
    stripTags,
    union,
    escapeRegExp,
    crash,
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
    hashedBlobId,
    toMap,
    isString
};
