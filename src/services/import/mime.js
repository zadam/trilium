"use strict";

const mimeTypes = require('mime-types');
const path = require('path');

const CODE_MIME_TYPES = {
    'plain': true,
    'c': true,
    'c++': true,
    'text/x-csharp': true,
    'text/x-clojure': true,
    'css': true,
    'text/x-dockerfile': true,
    'text/x-erlang': true,
    'text/x-feature': true,
    'go': true,
    'groovy': true,
    'haskell': true,
    'html': true,
    'http': true,
    'java': true,
    'javascript': 'javascript;env=frontend',
    'javascript': 'javascript;env=frontend',
    'json': true,
    'kotlin': true,
    'stex': true,
    'lua': true,
    // possibly later migrate to text/markdown as primary MIME
    'text/markdown': 'text/x-markdown',
    'text/x-markdown': true,
    'text/x-objectivec': true,
    'text/x-pascal': true,
    'perl': true,
    'php': true,
    'python': true,
    'ruby': true,
    'text/x-rustsrc': true,
    'text/x-scala': true,
    'sh': true,
    'sql': true,
    'swift': true,
    'xml': true,
    'yaml': true
};

// extensions missing in mime-db
const EXTENSION_TO_MIME = {
    ".c": "c",
    ".cs": "cs",
    ".clj": "text/x-clojure",
    ".erl": "text/x-erlang",
    ".hrl": "text/x-erlang",
    ".feature": "text/x-feature",
    ".go": "go",
    ".groovy": "groovy",
    ".hs": "haskell",
    ".lhs": "haskell",
    ".http": "http",
    ".kt": "kotlin",
    ".m": "text/x-objectivec",
    ".py": "python",
    ".rb": "ruby",
    ".scala": "text/x-scala",
    ".swift": "swift"
};

/** @returns false if MIME is not detected */
function getMime(fileName) {
    if (fileName.toLowerCase() === 'dockerfile') {
        return "text/x-dockerfile";
    }

    const ext = path.extname(fileName).toLowerCase();

    if (ext in EXTENSION_TO_MIME) {
        return EXTENSION_TO_MIME[ext];
    }

    return mimeTypes.lookup(fileName);
}

function getType(options, mime) {
    mime = mime ? mime.toLowerCase() : '';

    if (options.textImportedAsText && (mime === 'text/html' || ['text/markdown', 'text/x-markdown'].includes(mime))) {
        return 'text';
    }
    else if (options.codeImportedAsCode && mime in CODE_MIME_TYPES) {
        return 'code';
    }
    else if (mime.startsWith("image/")) {
        return 'image';
    }
    else {
        return 'file';
    }
}

function normalizeMimeType(mime) {
    mime = mime ? mime.toLowerCase() : '';

    if (!(mime in CODE_MIME_TYPES) || CODE_MIME_TYPES[mime] === true) {
        return mime;
    }
    else {
        return CODE_MIME_TYPES[mime];
    }
}

module.exports = {
    getMime,
    getType,
    normalizeMimeType
};