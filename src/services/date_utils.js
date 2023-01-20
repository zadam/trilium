const dayjs = require('dayjs');
const cls = require('./cls');

function utcNowDateTime() {
    return utcDateTimeStr(new Date());
}

// CLS date time is important in web deployments - server often runs in different time zone than user is located in,
// so we'd prefer client timezone to be used to record local dates. For this reason requests from client contain
// "trilium-local-now-datetime" header which is then stored in CLS
function localNowDateTime() {
    return cls.getLocalNowDateTime()
        || dayjs().format('YYYY-MM-DD HH:mm:ss.SSSZZ')
}

function localNowDate() {
    const clsDateTime = cls.getLocalNowDateTime();

    if (clsDateTime) {
        return clsDateTime.substr(0, 10);
    }
    else {
        const date = new Date();

        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
}

function pad(num) {
    return num <= 9 ? `0${num}` : `${num}`;
}

function utcDateStr(date) {
    return date.toISOString().split('T')[0];
}

function utcDateTimeStr(date) {
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
        throw new Error(`Can't parse date from ${str}: ${e.stack}`);
    }
}

function parseDate(str) {
    const datePart = str.substr(0, 10);

    return parseDateTime(`${datePart}T12:00:00.000Z`);
}

function parseLocalDate(str) {
    const datePart = str.substr(0, 10);

    // not specifying the timezone and specifying the time means Date.parse() will use the local timezone
    return parseDateTime(`${datePart} 12:00:00.000`);
}

function getDateTimeForFile() {
    return new Date().toISOString().substr(0, 19).replace(/:/g, '');
}

/**
 * Modify from https://stackoverflow.com/a/9047794
 * Returns the week number for this date
 */
function getWeek(date, startOfTheWeek) {
    let dowOffset;
    if (startOfTheWeek === 'monday') {
        dowOffset = 1;
    }
    else if (startOfTheWeek === 'sunday') {
        dowOffset = 0;
    }
    else {
        throw new Error(`Unrecognized start of the week ${startOfTheWeek}`);
    }
    const newYear = new Date(date.getFullYear(),0,1);
    let day = newYear.getDay()-dowOffset; //the day of week the year begins on
    day = (day >= 0 ? day : day + 7);
    const daynum = Math.floor((date.getTime()-newYear.getTime()-(date.getTimezoneOffset()-newYear.getTimezoneOffset())*60000)/86400000) + 1;
    let weeknum;
    // if the year starts before the middle of a week
    if (day < 4) {
        weeknum = Math.floor((daynum+day-1)/7) + 1;
        if (weeknum > 52) {
            const nYear = new Date(date.getFullYear() + 1,0,1);
            let nday = nYear.getDay() - dowOffset;
            nday = nday >= 0 ? nday : nday + 7;
            // if the next year starts before the middle of the week, it is week #1 of that year
            weeknum = nday < 4 ? 1 : 53;
        }
    }
    else {
        weeknum = Math.floor((daynum+day-1)/7);
    }
    return weeknum;
}

module.exports = {
    utcNowDateTime,
    localNowDateTime,
    localNowDate,
    utcDateStr,
    utcDateTimeStr,
    parseDate,
    parseDateTime,
    parseLocalDate,
    getDateTimeForFile,
    getWeek
};
