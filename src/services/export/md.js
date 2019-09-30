"use strict";

const TurndownService = require('turndown');
const turndownPluginGfm = require('turndown-plugin-gfm');

let instance = null;

function toMarkdown(content) {
    if (instance === null) {
        instance = new TurndownService();
        instance.use(turndownPluginGfm.gfm);
    }

    return instance.turndown(content);
}

module.exports = {
    toMarkdown
};