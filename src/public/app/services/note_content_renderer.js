import server from "./server.js";
import renderService from "./render.js";
import protectedSessionService from "./protected_session.js";
import protectedSessionHolder from "./protected_session_holder.js";
import libraryLoader from "./library_loader.js";
import openService from "./open.js";

async function getRenderedContent(note, options = {}) {
    options = Object.assign({
        trim: false
    }, options);

    const type = getRenderingType(note);

    let $rendered;

    if (type === 'text') {
        const fullNote = await server.get('notes/' + note.noteId);

        $rendered = $('<div class="ck-content">').html(trim(fullNote.content, options.trim));

        if ($rendered.find('span.math-tex').length > 0) {
            await libraryLoader.requireLibrary(libraryLoader.KATEX);

            renderMathInElement($rendered[0], {});
        }
    }
    else if (type === 'code') {
        const fullNote = await server.get('notes/' + note.noteId);

        $rendered = $("<pre>").text(trim(fullNote.content, options.trim));
    }
    else if (type === 'image') {
        $rendered = $("<img>")
            .attr("src", `api/images/${note.noteId}/${note.title}`)
            .css("max-width", "100%");
    }
    else if (type === 'file' || type === 'pdf') {
        const $downloadButton = $('<button class="file-download btn btn-primary" type="button">Download</button>');
        const $openButton = $('<button class="file-open btn btn-primary" type="button">Open</button>');

        $downloadButton.on('click', () => openService.downloadFileNote(note.noteId));
        $openButton.on('click', () => openService.openFileNote(note.noteId));

        // open doesn't work for protected notes since it works through browser which isn't in protected session
        $openButton.toggle(!note.isProtected);

        $rendered = $('<div style="display: flex; flex-direction: column; height: 100%;">');

        if (type === 'pdf') {
            const $pdfPreview = $('<iframe class="pdf-preview" style="width: 100%; flex-grow: 100;"></iframe>');
            $pdfPreview.attr("src", openService.getUrlForDownload("api/notes/" + note.noteId + "/open"));

            $rendered.append($pdfPreview);
        }

        $rendered.append(
            $("<div>")
                .append($downloadButton)
                .append(' &nbsp; ')
                .append($openButton)
        );
    }
    else if (type === 'render') {
        $rendered = $('<div>');

        await renderService.render(note, $rendered, this.ctx);
    }
    else if (type === 'protected-session') {
        const $button = $(`<button class="btn btn-sm"><span class="bx bx-log-in"></span> Enter protected session</button>`)
            .on('click', protectedSessionService.enterProtectedSession);

        $rendered = $("<div>")
            .append("<div>This note is protected and to access it you need to enter password.</div>")
            .append("<br/>")
            .append($button);
    }
    else {
        $rendered = $("<em>Content of this note cannot be displayed in the book format</em>");
    }

    $rendered.addClass(note.getCssClass());

    return {
        renderedContent: $rendered,
        type
    };
}

function trim(text, doTrim) {
    if (!doTrim) {
        return text;
    }
    else {
        return text.substr(0, Math.min(text.length, 1000));
    }
}

function getRenderingType(note) {
    let type = note.type;

    if (type === 'file' && note.mime === 'application/pdf') {
        type = 'pdf';
    }

    if (note.isProtected) {
        if (protectedSessionHolder.isProtectedSessionAvailable()) {
            protectedSessionHolder.touchProtectedSession();
        }
        else {
            type = 'protected-session';
        }
    }

    return type;
}

export default {
    getRenderedContent
};
