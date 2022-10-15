import server from "./server.js";
import renderService from "./render.js";
import protectedSessionService from "./protected_session.js";
import protectedSessionHolder from "./protected_session_holder.js";
import libraryLoader from "./library_loader.js";
import openService from "./open.js";
import froca from "./froca.js";
import utils from "./utils.js";
import linkService from "./link.js";

let idCounter = 1;

async function getRenderedContent(note, options = {}) {
    options = Object.assign({
        trim: false,
        tooltip: false
    }, options);

    const type = getRenderingType(note);

    const $renderedContent = $('<div class="rendered-note-content">');

    if (type === 'text') {
        const noteComplement = await froca.getNoteComplement(note.noteId);

        if (!utils.isHtmlEmpty(noteComplement.content)) {
            $renderedContent.append($('<div class="ck-content">').html(trim(noteComplement.content, options.trim)));

            if ($renderedContent.find('span.math-tex').length > 0) {
                await libraryLoader.requireLibrary(libraryLoader.KATEX);

                renderMathInElement($renderedContent[0], {trust: true});
            }
        }
        else {
            $renderedContent.css("padding", "10px");
            $renderedContent.addClass("text-with-ellipsis");

            let childNoteIds = note.getChildNoteIds();

            if (childNoteIds.length > 10) {
                childNoteIds = childNoteIds.slice(0, 10);
            }

            // just load the first 10 child notes
            const childNotes = await froca.getNotes(childNoteIds);

            for (const childNote of childNotes) {
                $renderedContent.append(await linkService.createNoteLink(`${note.noteId}/${childNote.noteId}`, {
                    showTooltip: false,
                    showNoteIcon: true
                }));

                $renderedContent.append("<br>");
            }
        }
    }
    else if (type === 'code') {
        const fullNote = await server.get('notes/' + note.noteId);

        $renderedContent.append($("<pre>").text(trim(fullNote.content, options.trim)));
    }
    else if (type === 'image') {
        const sanitizedTitle = note.title.replace(/[^a-z0-9-.]/gi, "");

        $renderedContent.append(
            $("<img>")
                .attr("src", `api/images/${note.noteId}/${sanitizedTitle}`)
                .css("max-width", "100%")
        );
    }
    else if (!options.tooltip && ['file', 'pdf', 'audio', 'video'].includes(type)) {
        const $downloadButton = $('<button class="file-download btn btn-primary" type="button">Download</button>');
        const $openButton = $('<button class="file-open btn btn-primary" type="button">Open</button>');

        $downloadButton.on('click', () => openService.downloadFileNote(note.noteId));
        $openButton.on('click', () => openService.openNoteExternally(note.noteId, note.mime));

        // open doesn't work for protected notes since it works through browser which isn't in protected session
        $openButton.toggle(!note.isProtected);

        const $content = $('<div style="display: flex; flex-direction: column; height: 100%;">');

        if (type === 'pdf') {
            const $pdfPreview = $('<iframe class="pdf-preview" style="width: 100%; flex-grow: 100;"></iframe>');
            $pdfPreview.attr("src", openService.getUrlForDownload("api/notes/" + note.noteId + "/open"));

            $content.append($pdfPreview);
        }
        else if (type === 'audio') {
            const $audioPreview = $('<audio controls></audio>')
                .attr("src", openService.getUrlForStreaming("api/notes/" + note.noteId + "/open-partial"))
                .attr("type", note.mime)
                .css("width", "100%");

            $content.append($audioPreview);
        }
        else if (type === 'video') {
            const $videoPreview = $('<video controls></video>')
                .attr("src", openService.getUrlForDownload("api/notes/" + note.noteId + "/open-partial"))
                .attr("type", note.mime)
                .css("width", "100%");

            $content.append($videoPreview);
        }

        $content.append(
            $('<div style="display: flex; justify-content: space-evenly; margin-top: 5px;">')
                .append($downloadButton)
                .append($openButton)
        );

        $renderedContent.append($content);
    }
    else if (type === 'mermaid') {
        await libraryLoader.requireLibrary(libraryLoader.MERMAID);

        const noteComplement = await froca.getNoteComplement(note.noteId);
        const content = noteComplement.content || "";

        $renderedContent
            .css("display", "flex")
            .css("justify-content", "space-around");

        const documentStyle = window.getComputedStyle(document.documentElement);
        const mermaidTheme = documentStyle.getPropertyValue('--mermaid-theme');

        mermaid.mermaidAPI.initialize({ startOnLoad: false, theme: mermaidTheme.trim(), securityLevel: 'antiscript' });

        try {
            mermaid.mermaidAPI.render("in-mermaid-graph-" + idCounter++, content,
                    content => $renderedContent.append($(content)));
        } catch (e) {
            const $error = $("<p>The diagram could not displayed.</p>");

            $renderedContent.append($error);
        }
    }
    else if (type === 'render') {
        const $content = $('<div>');

        await renderService.render(note, $content, this.ctx);

        $renderedContent.append($content);
    }
    else if (type === 'canvas') {
        // make sure surrounding container has size of what is visible. Then image is shrinked to its boundaries
        $renderedContent.css({height: "100%", width:"100%"});

        const noteComplement = await froca.getNoteComplement(note.noteId);
        const content = noteComplement.content || "";

        try {
            const placeHolderSVG = "<svg />";
            const data = JSON.parse(content)
            const svg = data.svg || placeHolderSVG;
            /**
             * maxWidth: size down to 100% (full) width of container but do not enlarge!
             * height:auto to ensure that height scales with width
             */
            $renderedContent.append($(svg).css({maxWidth: "100%", maxHeight: "100%", height: "auto", width: "auto"}));
        } catch(err) {
            console.error("error parsing content as JSON", content, err);
            $renderedContent.append($("<div>").text("Error parsing content. Please check console.error() for more details."));
        }
    }
    else if (!options.tooltip && type === 'protected-session') {
        const $button = $(`<button class="btn btn-sm"><span class="bx bx-log-in"></span> Enter protected session</button>`)
            .on('click', protectedSessionService.enterProtectedSession);

        $renderedContent.append(
            $("<div>")
                .append("<div>This note is protected and to access it you need to enter password.</div>")
                .append("<br/>")
                .append($button)
        );
    }
    else {
        $renderedContent.append($("<p><em>Content of this note cannot be displayed in the book format</em></p>"));
    }

    $renderedContent.addClass(note.getCssClass());

    return {
        $renderedContent,
        type
    };
}

function trim(text, doTrim) {
    if (!doTrim) {
        return text;
    }
    else {
        return text.substr(0, Math.min(text.length, 2000));
    }
}

function getRenderingType(note) {
    let type = note.type;

    if (type === 'file' && note.mime === 'application/pdf') {
        type = 'pdf';
    } else if (type === 'file' && note.mime.startsWith('audio/')) {
        type = 'audio';
    } else if (type === 'file' && note.mime.startsWith('video/')) {
        type = 'video';
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
