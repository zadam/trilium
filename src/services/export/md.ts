"use strict";

import TurndownService = require('turndown');
import turndownPluginGfm = require('joplin-turndown-plugin-gfm');

let instance: TurndownService | null = null;

function toMarkdown(content: string) {
    if (instance === null) {
        instance = new TurndownService({ codeBlockStyle: 'fenced' });
        instance.use(turndownPluginGfm.gfm);
    }

    return instance.turndown(content);
}

export = {
    toMarkdown
};
