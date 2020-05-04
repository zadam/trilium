const utils = require('./utils');

const VIRTUAL_ATTRIBUTES = [
    "dateCreated",
    "dateModified",
    "utcDateCreated",
    "utcDateModified",
    "noteId",
    "isProtected",
    "title",
    "content",
    "type",
    "mime",
    "text",
    "parentCount"
];

module.exports = function(filters, selectedColumns = 'notes.*') {
    // alias => join
    const joins = {
        "notes": null
    };

    let attrFilterId = 1;

    function getAccessor(property) {
        let accessor;

        if (!VIRTUAL_ATTRIBUTES.includes(property)) {
            // not reusing existing filters to support multi-valued filters e.g. "@tag=christmas @tag=shopping"
            // can match notes because @tag can be both "shopping" and "christmas"
            const alias = "attr_" + property + "_" + attrFilterId++;

            // forcing to use particular index since SQLite query planner would often choose something pretty bad
            joins[alias] = `LEFT JOIN attributes AS ${alias} INDEXED BY IDX_attributes_noteId_index `
                + `ON ${alias}.noteId = notes.noteId `
                + `AND ${alias}.name = '${property}' AND ${alias}.isDeleted = 0`;

            accessor = `${alias}.value`;
        }
        else if (property === 'content') {
            const alias = "note_contents";

            if (!(alias in joins)) {
                joins[alias] = `LEFT JOIN note_contents ON note_contents.noteId = notes.noteId`;
            }

            accessor = `${alias}.${property}`;
        }
        else if (property === 'parentCount') {
            // need to cast as string for the equality operator to work
            // for >= etc. it is cast again to DECIMAL
            // also cannot use COUNT() in WHERE so using subquery ...
            accessor = `CAST((SELECT COUNT(1) FROM branches WHERE branches.noteId = notes.noteId AND isDeleted = 0) AS STRING)`;
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
            const cleanedProp = prop.trim().replace(/-/g, "");

            return getAccessor(cleanedProp) + " " + direction;
        });
    }

    let where = '1';
    const params = [];

        for (const filter of filters) {
            if (['isarchived', 'in', 'orderby', 'limit'].includes(filter.name.toLowerCase())) {
                continue; // these are not real filters
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
            where += `${accessor} ${filter.operator} ?`;
                params.push(filter.value);
            } else if (filter.operator === '*=' || filter.operator === '!*=') {
            where += `${accessor}`
                    + (filter.operator.includes('!') ? ' NOT' : '')
                    + ` LIKE ` + utils.prepareSqlForLike('%', filter.value, '');
            } else if (filter.operator === '=*' || filter.operator === '!=*') {
            where += `${accessor}`
                    + (filter.operator.includes('!') ? ' NOT' : '')
                    + ` LIKE ` + utils.prepareSqlForLike('', filter.value, '%');
            } else if (filter.operator === '*=*' || filter.operator === '!*=*') {
                const columns = filter.name === 'text' ? [getAccessor("title"), getAccessor("content")] : [accessor];

                let condition = "(" + columns.map(column =>
                    `${column}` + ` LIKE ` + utils.prepareSqlForLike('%', filter.value, '%'))
                    .join(" OR ") + ")";

                if (filter.operator.includes('!')) {
                    condition = "NOT(" + condition + ")";
                }

                if (['text', 'title', 'content'].includes(filter.name)) {
                    // for title/content search does not make sense to search for protected notes
                    condition = `(${condition} AND notes.isProtected = 0)`;
                }

            where += condition;
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
                } else {
                where += `CAST(${accessor} AS DECIMAL) ${filter.operator} ?`;
                    params.push(floatParam);
                }
            } else {
                throw new Error("Unknown operator " + filter.operator);
            }
        }

    if (orderBy.length === 0) {
        // if no ordering is given then order at least by note title
        orderBy.push("notes.title");
    }

    const query = `SELECT ${selectedColumns} FROM notes
            ${Object.values(joins).join('\r\n')}
              WHERE
                notes.isDeleted = 0
                AND (${where})
              GROUP BY notes.noteId
              ORDER BY ${orderBy.join(", ")}`;

    return { query, params };
};
