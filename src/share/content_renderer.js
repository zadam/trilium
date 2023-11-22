const {JSDOM} = require("jsdom");
const shaca = require('./shaca/shaca.js');
const assetPath = require('../services/asset_path.js');
const shareRoot = require('./share_root.js');
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
        renderMermaid(result, note);
    } else if (note.type === 'image' || note.type === 'canvas') {
        renderImage(result, note);
    } else if (note.type === 'file') {
        renderFile(note, result);
    } else if (note.type === 'book') {
        result.isEmpty = true;
    } else {
        result.content = '<p>This note type cannot be displayed.</p>';
    }

    return result;
}

function renderIndex(result) {
    result.content += '<ul id="index">';

    const rootNote = shaca.getNote(shareRoot.SHARE_ROOT_NOTE_ID);

    for (const childNote of rootNote.getChildNotes()) {
        const isExternalLink = childNote.hasLabel("shareExternalLink");
        const href = isExternalLink ? childNote.getLabelValue("shareExternalLink") : `./${childNote.shareId}`;
        const target = isExternalLink ? `target="_blank" rel="noopener noreferrer"` : "";
        result.content += `<li><a class="${childNote.type}" href="${href}" ${target}>${childNote.escapedTitle}</a></li>`;
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

            if (!href?.startsWith("#")) {
                continue;
            }

            const linkRegExp = /attachmentId=([a-zA-Z0-9_]+)/g;
            let attachmentMatch
            if (attachmentMatch = linkRegExp.exec(href)) {
                const attachmentId = attachmentMatch[1];
                const attachment = shaca.getAttachment(attachmentId);

                if (attachment) {
                    linkEl.setAttribute("href", `api/attachments/${attachmentId}/download`);
                    linkEl.classList.add(`attachment-link`);
                    linkEl.classList.add(`role-${attachment.role}`);
                    linkEl.innerText = attachment.title;
                } else {
                    linkEl.removeAttribute("href");
                }
            } else {
                const [notePath] = href.split('?');
                const notePathSegments = notePath.split("/");
                const noteId = notePathSegments[notePathSegments.length - 1];
                const linkedNote = shaca.getNote(noteId);
                if (linkedNote) {
                    const isExternalLink = linkedNote.hasLabel("shareExternalLink");
                    const href = isExternalLink ? linkedNote.getLabelValue("shareExternalLink") : `./${linkedNote.shareId}`;
                    linkEl.setAttribute("href", href);
                    if (isExternalLink) {
                        linkEl.setAttribute("target", "_blank");
                        linkEl.setAttribute("rel", "noopener noreferrer");
                    }
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

function renderMermaid(result, note) {
    result.content = `
<img src="api/images/${note.noteId}/${note.escapedTitle}?${note.utcDateModified}">
<hr>
<details>
    <summary>Chart source</summary>
    <pre>${escapeHtml(result.content)}</pre>
</details>`
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

module.exports = {
    getContent
};
