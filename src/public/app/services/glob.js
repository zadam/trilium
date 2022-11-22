import utils from "./utils.js";
import appContext from "./app_context.js";
import server from "./server.js";
import libraryLoader from "./library_loader.js";
import ws from "./ws.js";
import froca from "./froca.js";

function setupGlobs() {
    window.glob.PROFILING_LOG = false;

    window.glob.isDesktop = utils.isDesktop;
    window.glob.isMobile = utils.isMobile;

    window.glob.getComponentByEl = el => appContext.getComponentByEl(el);
    window.glob.getHeaders = server.getHeaders;

    // required for ESLint plugin and CKEditor
    window.glob.getActiveTabNote = () => appContext.tabManager.getActiveContextNote();
    window.glob.requireLibrary = libraryLoader.requireLibrary;
    window.glob.ESLINT = libraryLoader.ESLINT;
    window.glob.appContext = appContext; // for debugging
    window.glob.froca = froca;
    window.glob.treeCache = froca; // compatibility for CKEditor builds for a while

    // for CKEditor integration (button on block toolbar)
    window.glob.importMarkdownInline = async () => appContext.triggerCommand("importMarkdownInline");

    window.glob.SEARCH_HELP_TEXT = `
    <strong>Search tips</strong> - also see <button class="btn btn-sm" type="button" data-help-page="Search">complete help on search</button>
    <p>
    <ul>
        <li>Just enter any text for full text search</li>
        <li><code>#abc</code> - returns notes with label abc</li>
        <li><code>#year = 2019</code> - matches notes with label <code>year</code> having value <code>2019</code></li>
        <li><code>#rock #pop</code> - matches notes which have both <code>rock</code> and <code>pop</code> labels</li>
        <li><code>#rock or #pop</code> - only one of the labels must be present</li>
        <li><code>#year &lt;= 2000</code> - numerical comparison (also &gt;, &gt;=, &lt;).</li>
        <li><code>note.dateCreated >= MONTH-1</code> - notes created in the last month</li>
        <li><code>=handler</code> - will execute script defined in <code>handler</code> relation to get results</li>
    </ul>
    </p>`;

    window.onerror = function (msg, url, lineNo, columnNo, error) {
        const string = msg.toLowerCase();

        let message = "Uncaught error: ";

        if (string.includes("script error")) {
            message += 'No details available';
        } else {
            message += [
                'Message: ' + msg,
                'URL: ' + url,
                'Line: ' + lineNo,
                'Column: ' + columnNo,
                'Error object: ' + JSON.stringify(error),
                'Stack: ' + (error && error.stack)
            ].join(', ');
        }

        ws.logError(message);

        return false;
    };

    for (const appCssNoteId of glob.appCssNoteIds || []) {
        libraryLoader.requireCss(`api/notes/download/${appCssNoteId}`, false);
    }

    utils.initHelpButtons($(window));

    $("body").on("click", "a.external", function () {
        window.open($(this).attr("href"), '_blank');

        return false;
    });
}

export default {
    setupGlobs
}
