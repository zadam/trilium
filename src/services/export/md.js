"use strict";

const TurndownService = require('turndown');
const turndownPluginGfm = require('joplin-turndown-plugin-gfm');

let instance = null;

function toMarkdown(content) {
    if (instance === null) {
        instance = new TurndownService({ codeBlockStyle: 'fenced' });
        instance.use(turndownPluginGfm.gfm);
    }

    return instance.turndown(content);
}

module.exports = {
    toMarkdown
};
