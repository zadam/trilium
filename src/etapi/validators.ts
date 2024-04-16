import noteTypeService = require('../services/note_types');
import dateUtils = require('../services/date_utils');

function mandatory(obj: ValidatorArg) {
    if (obj === undefined) {
        return `mandatory, but not set`;
    }
}

function notNull(obj: ValidatorArg) {
    if (obj === null) {
        return `cannot be null`;
    }
}

function isString(obj: ValidatorArg) {
    if (obj === undefined || obj === null) {
        return;
    }

    if (typeof obj !== 'string') {
        return `'${obj}' is not a string`;
    }
}

function isLocalDateTime(obj: ValidatorArg) {
    if (typeof obj !== "string") {
        return;
    }

    return dateUtils.validateLocalDateTime(obj);
}

function isUtcDateTime(obj: ValidatorArg) {
    if (typeof obj !== "string") {
        return;
    }

    return dateUtils.validateUtcDateTime(obj);
}

function isBoolean(obj: ValidatorArg) {
    if (obj === undefined || obj === null) {
        return;
    }

    if (typeof obj !== 'boolean') {
        return `'${obj}' is not a boolean`;
    }
}

function isInteger(obj: ValidatorArg) {
    if (obj === undefined || obj === null) {
        return;
    }

    if (!Number.isInteger(obj)) {
        return `'${obj}' is not an integer`;
    }
}

function isNoteId(obj: ValidatorArg) {
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

function isNoteType(obj: ValidatorArg) {
    if (obj === undefined || obj === null) {
        return;
    }

    const noteTypes = noteTypeService.getNoteTypeNames();

    if (typeof obj !== "string" || !noteTypes.includes(obj)) {
        return `'${obj}' is not a valid note type, allowed types are: ${noteTypes.join(", ")}`;
    }
}

function isAttributeType(obj: ValidatorArg) {
    if (obj === undefined || obj === null) {
        return;
    }

    if (typeof obj !== "string" || !['label', 'relation'].includes(obj)) {
        return `'${obj}' is not a valid attribute type, allowed types are: label, relation`;
    }
}

function isValidEntityId(obj: ValidatorArg) {
    if (obj === undefined || obj === null) {
        return;
    }

    if (typeof obj !== 'string' || !/^[A-Za-z0-9_]{4,128}$/.test(obj)) {
        return `'${obj}' is not a valid entityId. Only alphanumeric characters are allowed of length 4 to 32.`;
    }
}

export = {
    mandatory,
    notNull,
    isString,
    isBoolean,
    isInteger,
    isNoteId,
    isNoteType,
    isAttributeType,
    isValidEntityId,
    isLocalDateTime,
    isUtcDateTime
};
