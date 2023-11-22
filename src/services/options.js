const becca = require('../becca/becca.js');
const sql = require('./sql.js');

/** @returns {string|null} */
function getOptionOrNull(name) {
    let option;

    if (becca.loaded) {
        option = becca.getOption(name);
    } else {
        // e.g. in initial sync becca is not loaded because DB is not initialized
        option = sql.getRow("SELECT * FROM options WHERE name = ?", [name]);
    }

    return option ? option.value : null;
}

/** @returns {string} */
function getOption(name) {
    const val = getOptionOrNull(name);

    if (val === null) {
        throw new Error(`Option '${name}' doesn't exist`);
    }

    return val;
}

/** @returns {int} */
function getOptionInt(name, defaultValue = undefined) {
    const val = getOption(name);

    const intVal = parseInt(val);

    if (isNaN(intVal)) {
        if (defaultValue === undefined) {
            throw new Error(`Could not parse '${val}' into integer for option '${name}'`);
        } else {
            return defaultValue;
        }
    }

    return intVal;
}

/** @returns {boolean} */
function getOptionBool(name) {
    const val = getOption(name);

    if (!['true', 'false'].includes(val)) {
        throw new Error(`Could not parse '${val}' into boolean for option '${name}'`);
    }

    return val === 'true';
}

function setOption(name, value) {
    if (value === true || value === false) {
        value = value.toString();
    }

    const option = becca.getOption(name);

    if (option) {
        option.value = value;

        option.save();
    }
    else {
        createOption(name, value, false);
    }
}

function createOption(name, value, isSynced) {
    // to avoid circular dependency, need to find a better solution
    const BOption = require('../becca/entities/boption.js');

    new BOption({
        name: name,
        value: value,
        isSynced: isSynced
    }).save();
}

function getOptions() {
    return Object.values(becca.options);
}

function getOptionMap() {
    const map = {};

    for (const option of Object.values(becca.options)) {
        map[option.name] = option.value;
    }

    return map;
}

module.exports = {
    getOption,
    getOptionInt,
    getOptionBool,
    setOption,
    createOption,
    getOptions,
    getOptionMap,
    getOptionOrNull
};
