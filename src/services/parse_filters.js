module.exports = function(searchText) {
    const labelFilters = [];

    const labelRegex = /(\b(and|or)\s+)?@(!?)([\w_-]+|"[^"]+")((=|!=|<|<=|>|>=)([\w_-]+|"[^"]+"))?/i;

    let match = labelRegex.exec(searchText);

    function trimQuotes(str) { return str.startsWith('"') ? str.substr(1, str.length - 2) : str; }

    while (match != null) {
        const relation = match[2] !== undefined ? match[2].toLowerCase() : 'and';
        const operator = match[3] === '!' ? 'not-exists' : 'exists';

        labelFilters.push({
            relation: relation,
            name: trimQuotes(match[4]),
            operator: match[6] !== undefined ? match[6] : operator,
            value: match[7] !== undefined ? trimQuotes(match[7]) : null
        });

        // remove labels from further fulltext search
        searchText = searchText.split(match[0]).join('');

        match = labelRegex.exec(searchText);
    }

    return {labelFilters: labelFilters, searchText};
};