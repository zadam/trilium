const {JSDOM} = require("jsdom");
const shaca = require("./shaca/shaca");

function getContent(note) {
    let content = note.getContent();
    let header = '';
    let isEmpty = false;

    if (note.type === 'text') {
        const document = new JSDOM(content || "").window.document;

        isEmpty = document.body.textContent.trim().length === 0
            && document.querySelectorAll("img").length === 0;

        if (!isEmpty) {
            for (const linkEl of document.querySelectorAll("a")) {
                const href = linkEl.getAttribute("href");

                if (href?.startsWith("#")) {
                    const notePathSegments = href.split("/");

                    const noteId = notePathSegments[notePathSegments.length - 1];
                    const linkedNote = shaca.getNote(noteId);

                    if (linkedNote) {
                        linkEl.setAttribute("href", linkedNote.shareId);
                        linkEl.classList.add("type-" + linkedNote.type);
                    }
                    else {
                        linkEl.removeAttribute("href");
                    }
                }
            }

            content = document.body.innerHTML;

            if (content.includes(`<span class="math-tex">`)) {
                header += `
<script src="../../libraries/katex/katex.min.js"></script>
<link rel="stylesheet" href="../../libraries/katex/katex.min.css">
<script src="../../libraries/katex/auto-render.min.js"></script>
<script src="../../libraries/katex/mhchem.min.js"></script>
<script>
document.addEventListener("DOMContentLoaded", function() {
    renderMathInElement(document.getElementById('content'));
});
</script>`;
            }
        }
    }
    else if (note.type === 'code') {
        if (!content?.trim()) {
            isEmpty = true;
        }
        else {
            const document = new JSDOM().window.document;

            const preEl = document.createElement('pre');
            preEl.appendChild(document.createTextNode(content));

            content = preEl.outerHTML;
        }
    }
    else if (note.type === 'mermaid') {
        content = `
<div class="mermaid">${content}</div>
<hr>
<details>
    <summary>Chart source</summary>
    <pre>${content}</pre>
</details>`
        header += `<script src="../../libraries/mermaid.min.js"></script>`;
    }
    else if (note.type === 'image') {
        content = `<img src="api/images/${note.noteId}/${note.title}?${note.utcDateModified}">`;
    }
    else if (note.type === 'file') {
        if (note.mime === 'application/pdf') {
            content = `<iframe class="pdf-view" src="api/notes/${note.noteId}/view"></iframe>`
        }
        else {
            content = `<button type="button" onclick="location.href='api/notes/${note.noteId}/download'">Download file</button>`;
        }
    }
    else if (note.type === 'book') {
        isEmpty = true;
    }
    else {
        content = '<p>This note type cannot be displayed.</p>';
    }

    return {
        header,
        content,
        isEmpty
    };
}

module.exports = {
    getContent
};




