import cssLoader from './css_loader.js';

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

const COMMONMARK = {js: ["libraries/commonmark.min.js"]};

const RELATION_MAP = {
    js: [
        "libraries/jsplumb.js",
        "libraries/panzoom.js"
    ],
    css: [
        "stylesheets/relation_map.css"
    ]
};

const LINK_MAP = {
    js: [
        "libraries/jsplumb.js",
        "libraries/panzoom.js",
        "libraries/springy.js"
    ],
    css: [
        "stylesheets/link_map.css"
    ]
};

const PRINT_THIS = {js: ["libraries/printThis.js"]};

async function requireLibrary(library) {
    if (library.css) {
        library.css.map(cssUrl => cssLoader.requireCss(cssUrl));
    }

    if (library.js) {
        for (const scriptUrl of library.js) {
            await requireScript(scriptUrl);
        }
    }
}

// we save the promises in case of the same script being required concurrently multiple times
const loadedScriptPromises = {};

async function requireScript(url) {
    if (!loadedScriptPromises[url]) {
        loadedScriptPromises[url] = $.ajax({
            url: url,
            dataType: "script",
            cache: true
        });
    }

    await loadedScriptPromises[url];
}

export default {
    requireLibrary,
    CKEDITOR,
    CODE_MIRROR,
    ESLINT,
    COMMONMARK,
    RELATION_MAP,
    LINK_MAP,
    PRINT_THIS
}