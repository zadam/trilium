"use strict"

function formatAttrForSearch(attr, searchWithValue) {
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

function formatValue(val) {
    if (!/[^\w_]/.test(val)) {
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

module.exports = {
    formatAttrForSearch
}
