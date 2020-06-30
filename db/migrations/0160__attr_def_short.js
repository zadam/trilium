const sql = require('../../src/services/sql');

module.exports = () => {
    for (const attr of sql.getRows("SELECT * FROM attributes WHERE name LIKE 'label:%'")) {
        const obj = JSON.parse(attr.value);

        const tokens = [];

        if (obj.isPromoted) {
            tokens.push('promoted');
        }

        if (obj.labelType) {
            tokens.push(obj.labelType);
        }

        if (obj.multiplicityType === 'singlevalue') {
            tokens.push('single');
        } else if (obj.multiplicityType === 'multivalue') {
            tokens.push('multi');
        }

        if (obj.numberPrecision) {
            tokens.push('precision='+obj.numberPrecision);
        }

        const newValue = tokens.join(',');

        sql.execute('UPDATE attributes SET value = ? WHERE attributeId = ?', [newValue, attr.attributeId]);
    }

    for (const attr of sql.getRows("SELECT * FROM attributes WHERE name LIKE 'relation:%'")) {
        const obj = JSON.parse(attr.value);

        const tokens = [];

        if (obj.isPromoted) {
            tokens.push('promoted');
        }

        if (obj.inverseRelation) {
            tokens.push('inverse=' + obj.inverseRelation);
        }

        if (obj.multiplicityType === 'singlevalue') {
            tokens.push('single');
        } else if (obj.multiplicityType === 'multivalue') {
            tokens.push('multi');
        }

        const newValue = tokens.join(',');

        sql.execute('UPDATE attributes SET value = ? WHERE attributeId = ?', [newValue, attr.attributeId]);
    }
};
