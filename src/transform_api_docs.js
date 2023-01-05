const sanitizeHtml = require('sanitize-html');

function transform(content) {
    return sanitizeHtml(content, {
        allowedTags: [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
            'li', 'b', 'i', 'strong', 'em', 'strike', 's', 'del', 'abbr', 'code', 'hr', 'br', 'div',
            'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'section', 'img',
            'figure', 'figcaption', 'span', 'label', 'input',
        ],
        allowedAttributes: {
            'a': [ 'href', 'class', 'data-note-path' ],
            'img': [ 'src' ],
            'section': [ 'class', 'data-note-id' ],
            'figure': [ 'class' ],
            'span': [ 'class', 'style' ],
            'label': [ 'class' ],
            'input': [ 'class', 'type', 'disabled' ],
            'code': [ 'class' ],
            'ul': [ 'class' ],
            'table': [ 'class' ],
            'en-media': [ 'hash' ]
        },
        allowedSchemes: ['http', 'https', 'ftp', 'mailto', 'data', 'evernote'],
        // transformTags: {
        //     'h1': (tagName, attribs) => {
        //         return {
        //             tagName: '<span>',
        //             // text: 'ddd'
        //         };
        //     }
        // },
    });
}

const fs = require("fs");
const path = require("path");
let sourceFiles = [];

const getFilesRecursively = (directory) => {
    const filesInDirectory = fs.readdirSync(directory);
    for (const file of filesInDirectory) {
        const absolute = path.join(directory, file);
        if (fs.statSync(absolute).isDirectory()) {
            getFilesRecursively(absolute);
        } else {
            sourceFiles.push(absolute);
        }
    }
};

getFilesRecursively('./docs');

for (const sourcePath of sourceFiles) {
    console.log("Transforming file", sourcePath);

    const content = fs.readFileSync(sourcePath);
    const transformedContent = transform(content);

    const destPath = sourcePath.replaceAll("docs", "docs/transformed");

    fs.mkdirSync(path.dirname(destPath), {recursive: true});
    fs.writeFileSync(destPath, transformedContent);

    console.log(destPath);
}