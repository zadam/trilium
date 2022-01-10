function isString(obj) {
    if (typeof obj !== 'string') {
        return `'${obj}' is not a string`;
    }
}

function isStringOrNull(obj) {
    if (obj) {
        return isString(obj);
    }
}

function isBoolean(obj) {
    if (typeof obj !== 'boolean') {
        return `'${obj}' is not a boolean`;
    }
}

function isInteger(obj) {
    if (!Number.isInteger(obj)) {
        return `'${obj}' is not an integer`;
    }
}

module.exports = {
    isString,
    isStringOrNull,
    isBoolean,
    isInteger
};