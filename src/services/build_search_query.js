const utils = require('./utils');

const VIRTUAL_ATTRIBUTES = ["dateCreated", "dateCreated", "dateModified", "utcDateCreated", "utcDateModified", "isProtected", "title", "content", "type", "mime", "text"];

module.exports = function(filters) {
    // alias => join
    const joins = {
        "notes": null
    };

    function getAccessor(property) {
        let accessor;

        if (!VIRTUAL_ATTRIBUTES.includes(property)) {
            const alias = "attr_" + property;

            if (!(alias in joins)) {
                joins[alias] = `LEFT JOIN attributes AS ${alias} `
                    + `ON ${alias}.noteId = notes.noteId `
                    + `AND ${alias}.name = '${property}' AND ${alias}.isDeleted = 0`;
            }

            accessor = `${alias}.value`;
        }
        else if (property === 'content') {
            const alias = "note_contents";

            if (!(alias in joins)) {
                joins[alias] = `JOIN note_contents ON note_contents.noteId = notes.noteId`;
            }

            accessor = `${alias}.${property}`;
        }
        else if (property === 'text') {
            const alias = "note_fulltext";

            if (!(alias in joins)) {
                joins[alias] = `JOIN note_fulltext ON note_fulltext.noteId = notes.noteId`;
            }

            accessor = alias;
        }
        else {
            accessor = "notes." + property;
        }

        return accessor;
    }

    let orderBy = [];

    const orderByFilter = filters.find(filter => filter.name.toLowerCase() === 'orderby');

    if (orderByFilter) {
        orderBy = orderByFilter.value.split(",").map(prop => {
            const direction = prop.includes("-") ? "DESC" : "ASC";
            const cleanedProp = prop.trim().replace("-", "");

            return getAccessor(cleanedProp) + " " + direction;
        });
    }

    let where = '1';
    const params = [];

    for (const filter of filters) {
        if (filter.name.toLowerCase() === 'orderby') {
            continue; // orderby is not real filter
        }

        where += " " + filter.relation + " ";

        const accessor = getAccessor(filter.name);

        if (filter.operator === 'exists') {
            where += `${accessor} IS NOT NULL`;
        }
        else if (filter.operator === 'not-exists') {
            where += `${accessor} IS NULL`;
        }
        else if (filter.operator === '=' || filter.operator === '!=') {
            if (filter.name === 'text') {
                const safeSearchText = utils.sanitizeSql(filter.value);
                let condition = accessor + ' ' + `MATCH '${safeSearchText}'`;

                if (filter.operator.includes("!")) {
                    // not supported!
                }
                else if (orderBy.length === 0) {
                    // if there's a positive full text search and there's no defined order then order by rank
                    orderBy.push("rank");
                }

                where += condition;
            }
            else {
                where += `${accessor} ${filter.operator} ?`;
                params.push(filter.value);
            }
        }
        else if (filter.operator === '*=' || filter.operator === '!*=') {
            where += `${accessor}`
                    + (filter.operator.includes('!') ? ' NOT' : '')
                    + ` LIKE '%` + filter.value + "'"; // FIXME: escaping
        }
        else if (filter.operator === '=*' || filter.operator === '!=*') {
            where += `${accessor}`
                    + (filter.operator.includes('!') ? ' NOT' : '')
                    + ` LIKE '` + filter.value + "%'"; // FIXME: escaping
        }
        else if (filter.operator === '*=*' || filter.operator === '!*=*') {
            where += `${accessor}`
                    + (filter.operator.includes('!') ? ' NOT' : '')
                    + ` LIKE '%` + filter.value + "%'"; // FIXME: escaping
        }
        else if ([">", ">=", "<", "<="].includes(filter.operator)) {
            let floatParam;

            // from https://stackoverflow.com/questions/12643009/regular-expression-for-floating-point-numbers
            if (/^[+-]?([0-9]*[.])?[0-9]+$/.test(filter.value)) {
                floatParam = parseFloat(filter.value);
            }

            if (floatParam === undefined || isNaN(floatParam)) {
                // if the value can't be parsed as float then we assume that string comparison should be used instead of numeric
                where += `${accessor} ${filter.operator} ?`;
                params.push(filter.value);
            }
            else {
                where += `CAST(${accessor} AS DECIMAL) ${filter.operator} ?`;
                params.push(floatParam);
            }
        }
        else {
            throw new Error("Unknown operator " + filter.operator);
        }
    }

    if (orderBy.length === 0) {
        // if no ordering is given then order at least by note title
        orderBy.push("notes.title");
    }

    const query = `SELECT DISTINCT notes.noteId FROM notes
            ${Object.values(joins).join('\r\n')}
              WHERE
                notes.isDeleted = 0
                AND (${where})
              ORDER BY ` + orderBy.join(", ");

    console.log(query);
    console.log(params);

    return { query, params };
};
