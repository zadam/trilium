module.exports = function(searchText) {
    const attrFilters = [];

    const attrRegex = /(\b(and|or)\s+)?@(!?)([\w_-]+|"[^"]+")((=|!=|<|<=|>|>=)([\w_-]+|"[^"]+"))?/i;

    let match = attrRegex.exec(searchText);

    function trimQuotes(str) { return str.startsWith('"') ? str.substr(1, str.length - 2) : str; }

    while (match != null) {
        const relation = match[2] !== undefined ? match[2].toLowerCase() : 'and';
        const operator = match[3] === '!' ? 'not-exists' : 'exists';

        attrFilters.push({
            relation: relation,
            name: trimQuotes(match[4]),
            operator: match[6] !== undefined ? match[6] : operator,
            value: match[7] !== undefined ? trimQuotes(match[7]) : null
        });

        // remove attributes from further fulltext search
        searchText = searchText.split(match[0]).join('');

        match = attrRegex.exec(searchText);
    }

    return {attrFilters, searchText};
};