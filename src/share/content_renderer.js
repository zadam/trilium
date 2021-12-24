const {JSDOM} = require("jsdom");
const NO_CONTENT = '<p>This note has no content.</p>';
const shaca = require("./shaca/shaca");

function getChildrenList(note) {
    if (note.hasChildren()) {
        const document = new JSDOM().window.document;

        const ulEl = document.createElement("ul");

        for (const childNote of note.getChildNotes()) {
            const li = document.createElement("li");
            const link = document.createElement("a");
            link.appendChild(document.createTextNode(childNote.title));
            link.setAttribute("href", childNote.noteId);

            li.appendChild(link);
            ulEl.appendChild(li);
        }

        return '<p>Child notes:</p>' + ulEl.outerHTML;
    }
    else {
        return '';
    }
}

function getContent(note) {
    let content = note.getContent();

    if (note.type === 'text') {
        const document = new JSDOM(content || "").window.document;

        const isEmpty = document.body.textContent.trim().length === 0
            && document.querySelectorAll("img").length === 0;

        if (isEmpty) {
            content = NO_CONTENT + getChildrenList(note);
        }
        else {
            for (const linkEl of document.querySelectorAll("a")) {
                const href = linkEl.getAttribute("href");

                if (href?.startsWith("#")) {
                    const notePathSegments = href.split("/");

                    const noteId = notePathSegments[notePathSegments.length - 1];
                    const linkedNote = shaca.getNote(noteId);

                    if (linkedNote) {
                        linkEl.setAttribute("href", linkedNote.shareId);
                    }
                    else {
                        linkEl.removeAttribute("href");
                    }
                }
            }

            content = document.body.innerHTML;
        }
    }
    else if (note.type === 'code' || note.type === 'mermaid') {
        if (!content?.trim()) {
            content = NO_CONTENT + getChildrenList(note);
        }
        else {
            const document = new JSDOM().window.document;

            const preEl = document.createElement('pre');
            preEl.appendChild(document.createTextNode(content));

            content = preEl.outerHTML;
        }
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
        content = getChildrenList(note);
    }
    else {
        content = '<p>This note type cannot be displayed.</p>' + getChildrenList(note);
    }

    return content;
}

module.exports = {
    getContent
};
