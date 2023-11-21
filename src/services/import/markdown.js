import { marked } from 'marked';
import htmlSanitizer from '../html_sanitizer.js'
import importUtils from './utils.js'

function renderToHtml(content, title) {
    const html = marked.parse(content, {
        mangle: false,
        headerIds: false
    });
    const h1Handled = importUtils.handleH1(html, title); // h1 handling needs to come before sanitization
    return htmlSanitizer.sanitize(h1Handled);
}

export default {
    renderToHtml
};
