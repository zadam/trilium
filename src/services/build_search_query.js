module.exports = function(labelFilters, searchText) {
    const joins = [];
    const joinParams = [];
    let where = '1';
    const whereParams = [];

    let i = 1;

    for (const filter of labelFilters) {
        joins.push(`LEFT JOIN labels AS label${i} ON label${i}.noteId = notes.noteId AND label${i}.name = ?`);
        joinParams.push(filter.name);

        where += " " + filter.relation + " ";

        if (filter.operator === 'exists') {
            where += `label${i}.labelId IS NOT NULL`;
        }
        else if (filter.operator === 'not-exists') {
            where += `label${i}.labelId IS NULL`;
        }
        else if (filter.operator === '=' || filter.operator === '!=') {
            where += `label${i}.value ${filter.operator} ?`;
            whereParams.push(filter.value);
        }
        else if ([">", ">=", "<", "<="].includes(filter.operator)) {
            const floatParam = parseFloat(filter.value);

            if (isNaN(floatParam)) {
                where += `label${i}.value ${filter.operator} ?`;
                whereParams.push(filter.value);
            }
            else {
                where += `CAST(label${i}.value AS DECIMAL) ${filter.operator} ?`;
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

    if (searchText.trim() !== '') {
        // searching in protected notes is pointless because of encryption
        searchCondition = ' AND (notes.isProtected = 0 AND (notes.title LIKE ? OR notes.content LIKE ?))';

        searchText = '%' + searchText.trim() + '%';

        searchParams.push(searchText);
        searchParams.push(searchText); // two occurences in searchCondition
    }

    const query = `SELECT DISTINCT notes.noteId FROM notes
            ${joins.join('\r\n')}
              WHERE 
                notes.isDeleted = 0
                AND (${where}) 
                ${searchCondition}`;

    const params = joinParams.concat(whereParams).concat(searchParams);

    return { query, params };
};