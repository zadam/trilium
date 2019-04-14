"use strict";

const dateNoteService = require('../../services/date_notes');

async function getDateNote(req) {
    return await dateNoteService.getDateNote(req.params.date);
}

async function getMonthNote(req) {
    return await dateNoteService.getMonthNote(req.params.month);
}

async function getYearNote(req) {
    return await dateNoteService.getYearNote(req.params.year);
}

module.exports = {
    getDateNote,
    getMonthNote,
    getYearNote
};