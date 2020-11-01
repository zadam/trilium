const sanitizeHtml = require('sanitize-html');

// intended mainly as protection against XSS via import
// secondarily it (partly) protects against "CSS takeover"
function sanitize(dirtyHtml) {
    return sanitizeHtml(dirtyHtml, {
        allowedTags: [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
            'li', 'b', 'i', 'strong', 'em', 'strike', 'abbr', 'code', 'hr', 'br', 'div',
            'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'section', 'img',
            'figure', 'span', 'label', 'input'
        ],
        allowedAttributes: {
            'a': [ 'href', 'class' ],
            'img': [ 'src' ],
            'section': [ 'class', 'data-note-id' ],
            'figure': [ 'class' ],
            'span': [ 'class', 'style' ],
            'label': [ 'class' ],
            'input': [ 'class', 'type', 'disabled' ],
            'code': [ 'class' ]
        },
        allowedSchemes: ['http', 'https', 'ftp', 'mailto', 'data', 'evernote']
    });
}

module.exports = {
    sanitize
};
