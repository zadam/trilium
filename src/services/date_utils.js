const dayjs = require('dayjs');

function utcNowDateTime() {
    return utcDateStr(new Date());
}

function localNowDateTime() {
    return dayjs().format('YYYY-MM-DD HH:mm:ss.SSSZZ')
}

function localNowDate() {
    const date = new Date();

    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function pad(num) {
    return num <= 9 ? `0${num}` : `${num}`;
}

function utcDateStr(date) {
    return date.toISOString().replace('T', ' ');
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

function parseLocalDate(str) {
    const datePart = str.substr(0, 10);

    // not specifying the timezone and specifying the time means Date.parse() will use the local timezone
    return parseDateTime(datePart + " 12:00:00.000");
}

function getDateTimeForFile() {
    return new Date().toISOString().substr(0, 19).replace(/:/g, '');
}

module.exports = {
    utcNowDateTime,
    localNowDateTime,
    localNowDate,
    utcDateStr,
    parseDate,
    parseDateTime,
    parseLocalDate,
    getDateTimeForFile
};