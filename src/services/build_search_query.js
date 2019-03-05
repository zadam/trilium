function isVirtualAttribute(filter) {
    return (
        filter.name == "dateModified"
        || filter.name == "dateCreated"
        || filter.name == "isProtected"
    );
}

function getValueForFilter(filter, i) {
    return (isVirtualAttribute(filter)
        ? `substr(notes.${filter.name}, 0, ${filter.value.length + 1})`
        :`attribute${i}.value`
    );
}

module.exports = function(attributeFilters) {
    const joins = [];
    const joinParams = [];
    let where = '1';
    const whereParams = [];

    let i = 1;

    for (const filter of attributeFilters) {
        const virtual = isVirtualAttribute(filter);

        if (!virtual) {
            joins.push(`LEFT JOIN attributes AS attribute${i} `
                + `ON attribute${i}.noteId = notes.noteId `
                + `AND attribute${i}.name = ? AND attribute${i}.isDeleted = 0`
            );
            joinParams.push(filter.name);
        }

        where += " " + filter.relation + " ";

        // the value we need to test
        const test = virtual ? filter.name : `attribute${i}.attributeId`;

        if (filter.operator === 'exists') {
            where += `${test} IS NOT NULL`;
        }
        else if (filter.operator === 'not-exists') {
            where += `${test} IS NULL`;
        }
        else if (filter.operator === '=' || filter.operator === '!=') {
            where += `${getValueForFilter(filter, i)} ${filter.operator} ?`;
            whereParams.push(filter.value);
        }
        else if ([">", ">=", "<", "<="].includes(filter.operator)) {
            let floatParam;
            const value = getValueForFilter(filter, i);

            // from https://stackoverflow.com/questions/12643009/regular-expression-for-floating-point-numbers
            if (/^[+-]?([0-9]*[.])?[0-9]+$/.test(filter.value)) {
                floatParam = parseFloat(filter.value);
            }

            if (floatParam === undefined || isNaN(floatParam)) {
                // if the value can't be parsed as float then we assume that string comparison should be used instead of numeric
                where += `${value} ${filter.operator} ?`;
                whereParams.push(filter.value);
            }
            else {
                where += `CAST(${value} AS DECIMAL) ${filter.operator} ?`;
                whereParams.push(floatParam);
            }
        }
        else {
            throw new Error("Unknown operator " + filter.operator);
        }

        i++;
    }

    let searchCondition = '';
    const searchParams = [];

    const query = `SELECT DISTINCT notes.noteId FROM notes
            ${joins.join('\r\n')}
              WHERE
                notes.isDeleted = 0
                AND (${where})
                ${searchCondition}`;

    const params = joinParams.concat(whereParams).concat(searchParams);

    return { query, params };
};
