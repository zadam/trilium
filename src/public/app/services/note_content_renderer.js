import server from "./server.js";
import utils from "./utils.js";
import renderService from "./render.js";
import protectedSessionService from "./protected_session.js";
import protectedSessionHolder from "./protected_session_holder.js";

async function getRenderedContent(note) {
    const type = getRenderingType(note);

    let $rendered;

    if (type === 'text') {
        const fullNote = await server.get('notes/' + note.noteId);

        $rendered = $('<div class="ck-content">').html(fullNote.content);
    }
    else if (type === 'code') {
        const fullNote = await server.get('notes/' + note.noteId);

        $rendered = $("<pre>").text(fullNote.content);
    }
    else if (type === 'image') {
        $rendered = $("<img>")
            .attr("src", `api/images/${note.noteId}/${note.title}`)
            .css("max-width", "100%");
    }
    else if (type === 'file') {
        function getFileUrl() {
            return utils.getUrlForDownload("api/notes/" + note.noteId + "/download");
        }

        const $downloadButton = $('<button class="file-download btn btn-primary" type="button">Download</button>');
        const $openButton = $('<button class="file-open btn btn-primary" type="button">Open</button>');

        $downloadButton.on('click', () => utils.download(getFileUrl()));
        $openButton.on('click', () => {
            if (utils.isElectron()) {
                const open = utils.dynamicRequire("open");

                open(getFileUrl(), {url: true});
            }
            else {
                window.location.href = getFileUrl();
            }
        });

        // open doesn't work for protected notes since it works through browser which isn't in protected session
        $openButton.toggle(!note.isProtected);

        $rendered = $('<div>');

        if (note.mime === 'application/pdf' && utils.isElectron()) {
            const $pdfPreview = $('<iframe class="pdf-preview" style="width: 100%; height: 100%; flex-grow: 100;"></iframe>');
            $pdfPreview.attr("src", utils.getUrlForDownload("api/notes/" + note.noteId + "/open"));

            $rendered.append($pdfPreview);
        }

        $rendered
            .append($downloadButton)
            .append(' &nbsp; ')
            .append($openButton);
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

function getRenderingType(note) {
    let type = note.type;

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