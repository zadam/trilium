const CKEDITOR = {"js": ["libraries/ckeditor/ckeditor.js"]};

const CODE_MIRROR = {
    js: [
        "libraries/codemirror/codemirror.js",
        "libraries/codemirror/addon/display/placeholder.js",
        "libraries/codemirror/addon/edit/matchbrackets.js",
        "libraries/codemirror/addon/edit/matchtags.js",
        "libraries/codemirror/addon/fold/xml-fold.js",
        "libraries/codemirror/addon/lint/lint.js",
        "libraries/codemirror/addon/lint/eslint.js",
        "libraries/codemirror/addon/mode/loadmode.js",
        "libraries/codemirror/addon/mode/multiplex.js",
        "libraries/codemirror/addon/mode/overlay.js",
        "libraries/codemirror/addon/mode/simple.js",
        "libraries/codemirror/addon/search/match-highlighter.js",
        "libraries/codemirror/mode/meta.js",
        "libraries/codemirror/keymap/vim.js"
    ],
    css: [
        "libraries/codemirror/codemirror.css",
        "libraries/codemirror/addon/lint/lint.css"
    ]
};

const ESLINT = {js: ["libraries/eslint.js"]};

const RELATION_MAP = {
    js: [
        "libraries/jsplumb.js",
        "libraries/panzoom.js"
    ],
    css: [
        "stylesheets/relation_map.css"
    ]
};

const PRINT_THIS = {js: ["libraries/printThis.js"]};

const CALENDAR_WIDGET = {css: ["stylesheets/calendar.css"]};

const KATEX = {
    js: [ "libraries/katex/katex.min.js", "libraries/katex/mhchem.min.js", "libraries/katex/auto-render.min.js" ],
    css: [ "libraries/katex/katex.min.css" ]
};

const WHEEL_ZOOM = {
    js: [ "libraries/wheel-zoom.min.js"]
};

const FORCE_GRAPH = {
    js: [ "libraries/force-graph.min.js"]
};

const MERMAID = {
    js: [ "libraries/mermaid.min.js" ]
}

const EXCALIDRAW = {
    js: [
        "node_modules/react/umd/react.production.min.js",
        "node_modules/react-dom/umd/react-dom.production.min.js",
        "node_modules/@excalidraw/excalidraw/dist/excalidraw.production.min.js",
    ]
};

const MARKJS = {
    js: [
        "libraries/jquery.mark.es6.min.js"
    ]
};

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

// we save the promises in case of the same script being required concurrently multiple times
const loadedScriptPromises = {};

async function requireScript(url) {
    url = `${window.glob.assetPath}/${url}`;

    if (!loadedScriptPromises[url]) {
        loadedScriptPromises[url] = $.ajax({
            url: url,
            dataType: "script",
            cache: true
        });
    }

    await loadedScriptPromises[url];
}

async function requireCss(url, prependAssetPath = true) {
    const cssLinks = Array
        .from(document.querySelectorAll('link'))
        .map(el => el.href);

    if (!cssLinks.some(l => l.endsWith(url))) {
        if (prependAssetPath) {
            url = `${window.glob.assetPath}/${url}`;
        }

        $('head').append($('<link rel="stylesheet" type="text/css" />').attr('href', url));
    }
}

export default {
    requireCss,
    requireLibrary,
    CKEDITOR,
    CODE_MIRROR,
    ESLINT,
    RELATION_MAP,
    PRINT_THIS,
    CALENDAR_WIDGET,
    KATEX,
    WHEEL_ZOOM,
    FORCE_GRAPH,
    MERMAID,
    EXCALIDRAW,
    MARKJS
}
