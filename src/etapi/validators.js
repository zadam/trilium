const noteTypeService = require("../services/note_types");

function mandatory(obj) {
    if (obj === undefined ) {
        return `mandatory, but not set`;
    }
}

function notNull(obj) {
    if (obj === null) {
        return `cannot be null`;
    }
}

function isString(obj) {
    if (obj === undefined || obj === null) {
        return;
    }

    if (typeof obj !== 'string') {
        return `'${obj}' is not a string`;
    }
}

function isBoolean(obj) {
    if (obj === undefined || obj === null) {
        return;
    }

    if (typeof obj !== 'boolean') {
        return `'${obj}' is not a boolean`;
    }
}

function isInteger(obj) {
    if (obj === undefined || obj === null) {
        return;
    }

    if (!Number.isInteger(obj)) {
        return `'${obj}' is not an integer`;
    }
}

function isNoteId(obj) {
    if (obj === undefined || obj === null) {
        return;
    }

    const becca = require('../becca/becca');

    if (typeof obj !== 'string') {
        return `'${obj}' is not a valid noteId`;
    }

    if (!(obj in becca.notes)) {
        return `Note '${obj}' does not exist`;
    }
}

function isNoteType(obj) {
    if (obj === undefined || obj === null) {
        return;
    }

    const noteTypes = noteTypeService.getNoteTypeNames();

    if (!noteTypes.includes(obj)) {
        return `'${obj}' is not a valid note type, allowed types are: ${noteTypes.join(", ")}`;
    }
}

function isAttributeType(obj) {
    if (obj === undefined || obj === null) {
        return;
    }

    if (!['label', 'relation'].includes(obj)) {
        return `'${obj}' is not a valid attribute type, allowed types are: label, relation`;
    }
}

function isValidEntityId(obj) {
    if (obj === undefined || obj === null) {
        return;
    }

    if (typeof obj !== 'string' || !/^[A-Za-z0-9_]{4,128}$/.test(obj)) {
        return `'${obj}' is not a valid entityId. Only alphanumeric characters are allowed of length 4 to 32.`;
    }
}

module.exports = {
    mandatory,
    notNull,
    isString,
    isBoolean,
    isInteger,
    isNoteId,
    isNoteType,
    isAttributeType,
    isValidEntityId
};
