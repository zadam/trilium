"use strict";

const marked = require("marked");
const htmlSanitizer = require('../html_sanitizer.js');
const importUtils = require('./utils.js');

function renderToHtml(content, title) {
    const html = marked.parse(content, {
        mangle: false,
        headerIds: false
    });
    const h1Handled = importUtils.handleH1(html, title); // h1 handling needs to come before sanitization
    return htmlSanitizer.sanitize(h1Handled);
}

module.exports = {
    renderToHtml
};
