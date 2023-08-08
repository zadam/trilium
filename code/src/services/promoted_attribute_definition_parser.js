function parse(value) {
    const tokens = value.split(',').map(t => t.trim());
    const defObj = {};

    for (const token of tokens) {
        if (token === 'promoted') {
            defObj.isPromoted = true;
        }
        else if (['text', 'number', 'boolean', 'date', 'enum', 'datetime', 'url'].includes(token)) {
            defObj.labelType = token;
        }
        else if (['single', 'multi'].includes(token)) {
            defObj.multiplicity = token;
        }
        else if (token.startsWith('precision')) {
            const chunks = token.split('=');

            defObj.numberPrecision = parseInt(chunks[1]);
        }
        else if (token.startsWith('enumValues')) {
            const chunks = token.split('=');
            
            defObj.enumValues = chunks[1].split(',');
        }
        else if (token.startsWith('inverse')) {
            const chunks = token.split('=');

            defObj.inverseRelation = chunks[1].replace(/[^\p{L}\p{N}_:]/ug, "")
        }
        else {
            console.log("Unrecognized attribute definition token:", token);
        }
    }

    return defObj;
}

module.exports = {
    parse
};
