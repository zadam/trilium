const {JSDOM} = require("jsdom");
const shaca = require("./shaca/shaca");
const assetPath = require("../services/asset_path");
const shareRoot = require('./share_root');
const escapeHtml = require('escape-html');

function getContent(note) {
    if (note.isProtected) {
        return {
            header: '',
            content: '<p>Protected note cannot be displayed</p>',
            isEmpty: false
        };
    }

    const result = {
        content: note.getContent(),
        header: '',
        isEmpty: false
    };

    if (note.type === 'text') {
        renderText(result, note);
    } else if (note.type === 'code') {
        renderCode(result);
    } else if (note.type === 'mermaid') {
        renderMermaid(result);
    } else if (note.type === 'image') {
        renderImage(result, note);
    } else if (note.type === 'file') {
        renderFile(note, result);
    } else if (note.type === 'book') {
        result.isEmpty = true;
    } else if (note.type === 'canvas') {
        renderCanvas(result, note);
    } else {
        result.content = '<p>This note type cannot be displayed.</p>';
    }

    return result;
}

function renderIndex(result) {
    result.content += '<ul id="index">';

    const rootNote = shaca.getNote(shareRoot.SHARE_ROOT_NOTE_ID);

    for (const childNote of rootNote.getChildNotes()) {
        result.content += `<li><a class="${childNote.type}" href="./${childNote.shareId}">${childNote.escapedTitle}</a></li>`;
    }

    result.content += '</ul>';
}

function renderText(result, note) {
    const document = new JSDOM(result.content || "").window.document;

    result.isEmpty = document.body.textContent.trim().length === 0
        && document.querySelectorAll("img").length === 0;

    if (!result.isEmpty) {
        for (const linkEl of document.querySelectorAll("a")) {
            const href = linkEl.getAttribute("href");

            if (href?.startsWith("#")) {
                const notePathSegments = href.split("/");

                const noteId = notePathSegments[notePathSegments.length - 1];
                const linkedNote = shaca.getNote(noteId);

                if (linkedNote) {
                    linkEl.setAttribute("href", linkedNote.shareId);
                    linkEl.classList.add(`type-${linkedNote.type}`);
                } else {
                    linkEl.removeAttribute("href");
                }
            }
        }

        result.content = document.body.innerHTML;

        if (result.content.includes(`<span class="math-tex">`)) {
            result.header += `
<script src="../../${assetPath}/libraries/katex/katex.min.js"></script>
<link rel="stylesheet" href="../../${assetPath}/libraries/katex/katex.min.css">
<script src="../../${assetPath}/libraries/katex/auto-render.min.js"></script>
<script src="../../${assetPath}/libraries/katex/mhchem.min.js"></script>
<script>
document.addEventListener("DOMContentLoaded", function() {
    renderMathInElement(document.getElementById('content'));
});
</script>`;
        }

        if (note.hasLabel("shareIndex")) {
            renderIndex(result);
        }
    }
}

function renderCode(result) {
    if (!result.content?.trim()) {
        result.isEmpty = true;
    } else {
        const document = new JSDOM().window.document;

        const preEl = document.createElement('pre');
        preEl.appendChild(document.createTextNode(result.content));

        result.content = preEl.outerHTML;
    }
}

function renderMermaid(result) {
    result.content = `
<div class="mermaid">${escapeHtml(result.content)}</div>
<hr>
<details>
    <summary>Chart source</summary>
    <pre>${escapeHtml(result.content)}</pre>
</details>`
    result.header += `<script src="../../${assetPath}/libraries/mermaid.min.js"></script>`;
}

function renderImage(result, note) {
    result.content = `<img src="api/images/${note.noteId}/${note.escapedTitle}?${note.utcDateModified}">`;
}

function renderFile(note, result) {
    if (note.mime === 'application/pdf') {
        result.content = `<iframe class="pdf-view" src="api/notes/${note.noteId}/view"></iframe>`
    } else {
        result.content = `<button type="button" onclick="location.href='api/notes/${note.noteId}/download'">Download file</button>`;
    }
}

function renderCanvas(result, note) {
    result.header += `<script>
                    window.EXCALIDRAW_ASSET_PATH = window.location.origin + "/node_modules/@excalidraw/excalidraw/dist/";
                   </script>`;
    result.header += `<script src="../../${assetPath}/node_modules/react/umd/react.production.min.js"></script>`;
    result.header += `<script src="../../${assetPath}/node_modules/react-dom/umd/react-dom.production.min.js"></script>`;
    result.header += `<script src="../../${assetPath}/node_modules/@excalidraw/excalidraw/dist/excalidraw.production.min.js"></script>`;
    result.header += `<style>

            .excalidraw-wrapper {
                height: 100%;
            }

            :root[dir="ltr"]
            .excalidraw
            .layer-ui__wrapper
            .zen-mode-transition.App-menu_bottom--transition-left {
                transform: none;
            }
        </style>`;

    result.content = `<div>
            <script>
                const {elements, appState, files} = JSON.parse(${JSON.stringify(result.content)});
                window.triliumExcalidraw = {elements, appState, files}
            </script>
            <div id="excalidraw-app"></div>
            <hr>
            <a href="api/images/${note.noteId}/${note.escapedTitle}?utc=${note.utcDateModified}">Get Image Link</a>
            <script src="./canvas_share.js"></script>
        </div>`;
}

module.exports = {
    getContent
};
