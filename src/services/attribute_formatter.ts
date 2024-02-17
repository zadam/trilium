"use strict";

import BAttribute = require("../becca/entities/battribute");

function formatAttrForSearch(attr: BAttribute, searchWithValue: string) {
    let searchStr = '';

    if (attr.type === 'label') {
        searchStr += '#';
    }
    else if (attr.type === 'relation') {
        searchStr += '~';
    }
    else {
        throw new Error(`Unrecognized attribute type ${JSON.stringify(attr)}`);
    }

    searchStr += attr.name;

    if (searchWithValue && attr.value) {
        if (attr.type === 'relation') {
            searchStr += ".noteId";
        }

        searchStr += '=';
        searchStr += formatValue(attr.value);
    }

    return searchStr;
}

function formatValue(val: string) {
    if (!/[^\w]/.test(val)) {
        return val;
    }
    else if (!val.includes('"')) {
        return `"${val}"`;
    }
    else if (!val.includes("'")) {
        return `'${val}'`;
    }
    else if (!val.includes("`")) {
        return `\`${val}\``;
    }
    else {
        return `"${val.replace(/"/g, '\\"')}"`;
    }
}

export = {
    formatAttrForSearch
};
