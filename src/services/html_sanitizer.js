const sanitizeHtml = require('sanitize-html');
const sanitizeUrl = require('@braintree/sanitize-url').sanitizeUrl;

// intended mainly as protection against XSS via import
// secondarily it (partly) protects against "CSS takeover"
// sanitize also note titles, label values etc. - there's so many usage which make it difficult to guarantee all of them
// are properly handled
function sanitize(dirtyHtml) {
    if (!dirtyHtml) {
        return dirtyHtml;
    }

    // avoid H1 per https://github.com/zadam/trilium/issues/1552
    // demote H1, and if that conflicts with existing H2, demote that, etc
    const transformTags = {};
    const lowercasedHtml = dirtyHtml.toLowerCase();
    for (let i = 1; i < 6; ++i) {
        if (lowercasedHtml.includes(`<h${i}`)) {
            transformTags[`h${i}`] = `h${i + 1}`;
        }
        else {
            break;
        }
    }

    // to minimize document changes, compress H
    return sanitizeHtml(dirtyHtml, {
        allowedTags: [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
            'li', 'b', 'i', 'strong', 'em', 'strike', 's', 'del', 'abbr', 'code', 'hr', 'br', 'div',
            'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'section', 'img',
            'figure', 'figcaption', 'span', 'label', 'input',
            'en-media' // for ENEX import
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
        allowedSchemes: [
            'http', 'https', 'ftp', 'ftps', 'mailto', 'data', 'evernote', 'file', 'facetime', 'irc', 'gemini', 'git',
            'gopher', 'imap', 'irc', 'irc6', 'jabber', 'jar', 'lastfm', 'ldap', 'ldaps', 'magnet', 'message',
            'mumble', 'nfs', 'onenote', 'pop', 'rmi', 's3', 'sftp', 'skype', 'sms', 'spotify', 'steam', 'svn', 'udp',
            'view-source', 'vnc', 'ws', 'wss', 'xmpp', 'jdbc', 'slack'
        ],
        transformTags,
    });
}

module.exports = {
    sanitize,
    sanitizeUrl
};
