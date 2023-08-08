"use strict";

const mimeTypes = require('mime-types');
const path = require('path');

const CODE_MIME_TYPES = {
    'text/plain': true,
    'text/x-csrc': true,
    'text/x-c++src': true,
    'text/x-csharp': true,
    'text/x-clojure': true,
    'text/css': true,
    'text/x-dockerfile': true,
    'text/x-erlang': true,
    'text/x-feature': true,
    'text/x-go': true,
    'text/x-groovy': true,
    'text/x-haskell': true,
    'text/html': true,
    'message/http': true,
    'text/x-java': true,
    'application/javascript': 'application/javascript;env=frontend',
    'application/x-javascript': 'application/javascript;env=frontend',
    'application/json': true,
    'text/x-kotlin': true,
    'text/x-stex': true,
    'text/x-lua': true,
    // possibly later migrate to text/markdown as primary MIME
    'text/markdown': 'text/x-markdown',
    'text/x-markdown': true,
    'text/x-objectivec': true,
    'text/x-pascal': true,
    'text/x-perl': true,
    'text/x-php': true,
    'text/x-python': true,
    'text/x-ruby': true,
    'text/x-rustsrc': true,
    'text/x-scala': true,
    'text/x-sh': true,
    'text/x-sql': true,
    'text/x-swift': true,
    'text/xml': true,
    'text/x-yaml': true
};

// extensions missing in mime-db
const EXTENSION_TO_MIME = {
    ".c": "text/x-csrc",
    ".cs": "text/x-csharp",
    ".clj": "text/x-clojure",
    ".erl": "text/x-erlang",
    ".hrl": "text/x-erlang",
    ".feature": "text/x-feature",
    ".go": "text/x-go",
    ".groovy": "text/x-groovy",
    ".hs": "text/x-haskell",
    ".lhs": "text/x-haskell",
    ".http": "message/http",
    ".kt": "text/x-kotlin",
    ".m": "text/x-objectivec",
    ".py": "text/x-python",
    ".rb": "text/x-ruby",
    ".scala": "text/x-scala",
    ".swift": "text/x-swift"
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