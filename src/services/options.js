function getOption(name) {
    const option = require('./repository').getOption(name);

    if (!option) {
        throw new Error(`Option ${name} doesn't exist`);
    }

    return option.value;
}

/**
 * @return {Promise<number>}
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
 * @return {Promise<boolean>}
 */
function getOptionBool(name) {
    const val = getOption(name);

    if (!['true', 'false'].includes(val)) {
        throw new Error(`Could not parse "${val}" into boolean for option "${name}"`);
    }

    return val === 'true';
}

function setOption(name, value) {
    const option = require('./repository').getOption(name);

    if (value === true || value === false) {
        value = value.toString();
    }

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
    const Option = require('../entities/option');

    new Option({
        name: name,
        value: value,
        isSynced: isSynced
    }).save();
}

function getOptions() {
    return require('./repository').getEntities("SELECT * FROM options ORDER BY name");
}

function getOptionsMap() {
    return require('./sql').getMap("SELECT name, value FROM options ORDER BY name");
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
