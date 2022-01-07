const specialNotesService = require("../services/special_notes");
const dateNotesService = require("../services/date_notes");
const ru = require("./route_utils");
const mappers = require("./mappers");

const getDateInvalidError = date => new ru.EtapiError(400, "DATE_INVALID", `Date "${date}" is not valid.`);
const getMonthInvalidError = month => new ru.EtapiError(400, "MONTH_INVALID", `Month "${month}" is not valid.`);
const getYearInvalidError = year => new ru.EtapiError(400, "YEAR_INVALID", `Year "${year}" is not valid.`);

function isValidDate(date) {
    if (!/[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(date)) {
        return false;
    }

    return !!Date.parse(date);
}

function register(router) {
    ru.route(router, 'get', '/etapi/inbox/:date', (req, res, next) => {
        const {date} = req.params;

        if (!isValidDate(date)) {
            throw getDateInvalidError(res, date);
        }

        const note = specialNotesService.getInboxNote(date);
        res.json(mappers.mapNoteToPojo(note));
    });

    ru.route(router, 'get', '/etapi/date/:date', (req, res, next) => {
        const {date} = req.params;

        if (!isValidDate(date)) {
            throw getDateInvalidError(res, date);
        }

        const note = dateNotesService.getDateNote(date);
        res.json(mappers.mapNoteToPojo(note));
    });

    ru.route(router, 'get', '/etapi/week/:date', (req, res, next) => {
        const {date} = req.params;

        if (!isValidDate(date)) {
            throw getDateInvalidError(res, date);
        }

        const note = dateNotesService.getWeekNote(date);
        res.json(mappers.mapNoteToPojo(note));
    });

    ru.route(router, 'get', '/etapi/month/:month', (req, res, next) => {
        const {month} = req.params;

        if (!/[0-9]{4}-[0-9]{2}/.test(month)) {
            throw getMonthInvalidError(res, month);
        }

        const note = dateNotesService.getMonthNote(month);
        res.json(mappers.mapNoteToPojo(note));
    });

    ru.route(router, 'get', '/etapi/year/:year', (req, res, next) => {
        const {year} = req.params;

        if (!/[0-9]{4}/.test(year)) {
            throw getYearInvalidError(res, year);
        }

        const note = dateNotesService.getYearNote(year);
        res.json(mappers.mapNoteToPojo(note));
    });
}

module.exports = {
    register
};