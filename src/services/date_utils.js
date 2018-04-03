function nowDate() {
    return dateStr(new Date());
}

function dateStr(date) {
    return date.toISOString();
}

/**
 * @param str - needs to be in the ISO 8601 format "YYYY-MM-DDTHH:MM:SS.sssZ" format as outputted by dateStr().
 *              also is assumed to be GMT time (as indicated by the "Z" at the end), *not* local time
 */
function parseDateTime(str) {
    try {
        return new Date(Date.parse(str));
    }
    catch (e) {
        throw new Error("Can't parse date from " + str + ": " + e.stack);
    }
}

function parseDate(str) {
    const datePart = str.substr(0, 10);

    return parseDateTime(datePart + "T12:00:00.000Z");
}

function getDateTimeForFile() {
    return new Date().toISOString().substr(0, 19).replace(/:/g, '');
}

module.exports = {
    nowDate,
    dateStr,
    parseDate,
    parseDateTime,
    getDateTimeForFile
};