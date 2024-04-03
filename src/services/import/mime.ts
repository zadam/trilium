"use strict";

import mimeTypes = require('mime-types');
import path = require('path');
import { TaskData } from '../task_context_interface';

const CODE_MIME_TYPES: Record<string, boolean | string> = {
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
const EXTENSION_TO_MIME: Record<string, string> = {
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
function getMime(fileName: string) {
    if (fileName.toLowerCase() === 'dockerfile') {
        return "text/x-dockerfile";
    }

    const ext = path.extname(fileName).toLowerCase();

    if (ext in EXTENSION_TO_MIME) {
        return EXTENSION_TO_MIME[ext];
    }

    return mimeTypes.lookup(fileName);
}

function getType(options: TaskData, mime: string) {
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

function normalizeMimeType(mime: string) {
    mime = mime ? mime.toLowerCase() : '';
    const mappedMime = CODE_MIME_TYPES[mime];

    if (mappedMime === true) {
        return mime;
    } else if (typeof mappedMime === "string") {
        return mappedMime;
    }

    return undefined;
}

export = {
    getMime,
    getType,
    normalizeMimeType
};