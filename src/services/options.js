const becca = require('../becca/becca');
const sql = require("./sql.js");

function getOption(name) {
    let option;

    if (becca.loaded) {
        option = becca.getOption(name);
    }
    else {
        // e.g. in initial sync becca is not loaded because DB is not initialized
        option = sql.getRow("SELECT * FROM options WHERE name = ?", name);
    }

    if (!option) {
        throw new Error(`Option "${name}" doesn't exist`);
    }

    return option.value;
}

/**
 * @return {number}
 */
function getOptionInt(name) {
    const val = getOption(name);

    const intVal = parseInt(val);

    if (isNaN(intVal)) {
        throw new Error(`Could not parse "${val}" into integer for option "${name}"`);
    }

    return intVal;
}

/**
 * @return {boolean}
 */
function getOptionBool(name) {
    const val = getOption(name);

    if (!['true', 'false'].includes(val)) {
        throw new Error(`Could not parse "${val}" into boolean for option "${name}"`);
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
    // to avoid circular dependency, need to find better solution
    const Option = require('../becca/entities/option');

    new Option({
        name: name,
        value: value,
        isSynced: isSynced
    }).save();
}

function getOptions() {
    return Object.values(becca.options);
}

function getOptionsMap() {
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
    getOptionsMap
};
