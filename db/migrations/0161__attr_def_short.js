const sql = require('../../src/services/sql');

module.exports = () => {
    for (const attr of sql.getRows("SELECT * FROM attributes WHERE name LIKE 'label:%'")) {
        let obj;

        try {
            obj = JSON.parse(attr.value);
        }
        catch (e) {
            console.log(`Parsing attribute definition "${attr.value}" of ${attr.attributeId} failed with error "${e.message}", setting to default value.`);

            sql.execute('UPDATE attributes SET value = ? WHERE attributeId = ?',
                ["multi,text", attr.attributeId]);

            continue;
        }

        const tokens = [];

        if (obj.isPromoted) {
            tokens.push('promoted');
        }

        if (obj.multiplicityType === 'singlevalue') {
            tokens.push('single');
        } else if (obj.multiplicityType === 'multivalue') {
            tokens.push('multi');
        }

        if (obj.labelType) {
            tokens.push(obj.labelType);
        }

        if (obj.numberPrecision) {
            tokens.push('precision='+obj.numberPrecision);
        }

        const newValue = tokens.join(',');

        sql.execute('UPDATE attributes SET value = ? WHERE attributeId = ?', [newValue, attr.attributeId]);
    }

    for (const attr of sql.getRows("SELECT * FROM attributes WHERE name LIKE 'relation:%'")) {
        let obj;

        try {
            obj = JSON.parse(attr.value);
        }
        catch (e) {
            console.log(`Parsing attribute definition "${attr.value}" of ${attr.attributeId} failed with error "${e.message}", setting to default value.`);

            sql.execute('UPDATE attributes SET value = ? WHERE attributeId = ?',
                ["multi", attr.attributeId]);

            continue;
        }

        const tokens = [];

        if (obj.isPromoted) {
            tokens.push('promoted');
        }

        if (obj.multiplicityType === 'singlevalue') {
            tokens.push('single');
        } else if (obj.multiplicityType === 'multivalue') {
            tokens.push('multi');
        }

        if (obj.inverseRelation) {
            tokens.push('inverse=' + obj.inverseRelation);
        }

        const newValue = tokens.join(',');

        sql.execute('UPDATE attributes SET value = ? WHERE attributeId = ?', [newValue, attr.attributeId]);
    }
};
