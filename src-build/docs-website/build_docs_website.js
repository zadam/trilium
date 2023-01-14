const fs = require("fs-extra");
const utils = require("../../src/services/utils.js");
const html = require("html");

const SRC_DIR = './src-build/docs-website';
const USER_GUIDE_DIR = './docs/user_guide';
const META_PATH = USER_GUIDE_DIR + '/!!!meta.json';
const WEB_TMP_DIR = './tmp/user_guide_web';
fs.copySync(USER_GUIDE_DIR, WEB_TMP_DIR);

const meta = JSON.parse(readFile(META_PATH));
const rootNoteMeta = meta.files[0];
const noteIdToMeta = {};
createNoteIdToMetaMapping(rootNoteMeta);

addNavigationAndStyle(rootNoteMeta, WEB_TMP_DIR);

fs.writeFileSync(WEB_TMP_DIR + '/main.js', readFile(SRC_DIR + "/main.js"));
fs.writeFileSync(WEB_TMP_DIR + '/main.css', readFile(SRC_DIR + "/main.css"));
fs.cpSync('libraries/ckeditor/ckeditor-content.css' ,WEB_TMP_DIR + '/ckeditor-content.css');

function addNavigationAndStyle(noteMeta, parentDirPath) {
    const nav = createNavigation(rootNoteMeta, noteMeta);

    if (noteMeta.dataFileName) {
        const filePath = parentDirPath + "/" + noteMeta.dataFileName;

        console.log(`Adding nav to ${filePath}`);

        const content = readFile(filePath);
        const depth = noteMeta.notePath.length - 1;
        const updatedContent = content
            .replaceAll("</head>", `
<link rel="stylesheet" href="${"../".repeat(depth)}main.css">
<link rel="stylesheet" href="${"../".repeat(depth)}ckeditor-content.css">
<script src="${"../".repeat(depth)}main.js"></script>`)
            .replaceAll("</body>", nav + "</body>");
        const prettified = html.prettyPrint(updatedContent, {indent_size: 2});
        fs.writeFileSync(filePath, prettified);
    }

    for (const childNoteMeta of noteMeta.children || []) {
        addNavigationAndStyle(childNoteMeta, parentDirPath + '/' + noteMeta.dirFileName);
    }
}

function createNavigation(rootMeta, sourceMeta) {
    function saveNavigationInner(meta, parentNoteId = 'root') {
        let html = `<li data-branch-id="${parentNoteId}_${meta.noteId}">`;

        const escapedTitle = utils.escapeHtml(`${meta.prefix ? `${meta.prefix} - ` : ''}${meta.title}`);

        if (meta.dataFileName) {
            const targetUrl = getTargetUrl(meta.noteId, sourceMeta);

            html += `<a href="${targetUrl}">${escapedTitle}</a>`;
        }
        else {
            html += escapedTitle;
        }

        if (meta.children && meta.children.length > 0) {
            html += '<ul>';

            for (const child of meta.children) {
                html += saveNavigationInner(child, meta.noteId);
            }

            html += '</ul>'
        }

        return `${html}</li>`;
    }

    return `<nav class="note-tree-nav"><ul>${saveNavigationInner(rootMeta)}</ul></nav>`;
}

function createNoteIdToMetaMapping(noteMeta) {
    noteIdToMeta[noteMeta.noteId] = noteMeta;

    for (const childNoteMeta of noteMeta.children || []) {
        createNoteIdToMetaMapping(childNoteMeta);
    }
}

function getTargetUrl(targetNoteId, sourceMeta) {
    const targetMeta = noteIdToMeta[targetNoteId];

    if (!targetMeta) {
        throw new Error(`Could not find note meta for noteId '${targetNoteId}'`);
    }

    const targetPath = targetMeta.notePath.slice();
    const sourcePath = sourceMeta.notePath.slice();

    // > 1 for edge case that targetPath and sourcePath are exact same (link to itself)
    while (targetPath.length > 1 && sourcePath.length > 1 && targetPath[0] === sourcePath[0]) {
        targetPath.shift();
        sourcePath.shift();
    }

    let url = "../".repeat(sourcePath.length - 1);

    for (let i = 0; i < targetPath.length - 1; i++) {
        const meta = noteIdToMeta[targetPath[i]];

        if (!meta) {
            throw new Error(`Cannot resolve note '${targetPath[i]}' from path '${targetPath.toString()}'`);
        }

        url += `${encodeURIComponent(meta.dirFileName)}/`;
    }

    const targetPathNoteId = targetPath[targetPath.length - 1];
    const meta = noteIdToMeta[targetPathNoteId];

    if (!meta) {
        throw new Error(`Cannot resolve note '${targetPathNoteId}' from path '${targetPath.toString()}'`);
    }

    // link can target note which is only "folder-note" and as such will not have a file in an export
    url += encodeURIComponent(meta.dataFileName || meta.dirFileName);

    return url;
}

function readFile(filePath) {
    return fs.readFileSync(filePath).toString();
}
