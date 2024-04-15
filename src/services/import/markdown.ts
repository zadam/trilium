"use strict";

import marked = require("marked");
import htmlSanitizer = require('../html_sanitizer');
import importUtils = require('./utils');

function renderToHtml(content: string, title: string) {
    const html = marked.parse(content, {
        async: false
    }) as string;
    const h1Handled = importUtils.handleH1(html, title); // h1 handling needs to come before sanitization
    return htmlSanitizer.sanitize(h1Handled);
}

export = {
    renderToHtml
};
