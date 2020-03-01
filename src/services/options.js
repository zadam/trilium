const utils = require('./utils');

async function getOption(name) {
    const option = await require('./repository').getOption(name);

    if (!option) {
        throw new Error(`Option ${name} doesn't exist`);
    }

    return option.value;
}

/**
 * @return {Promise<number>}
 */
async function getOptionInt(name) {
    const val = await getOption(name);

    const intVal = parseInt(val);

    if (isNaN(intVal)) {
        throw new Error(`Could not parse "${val}" into integer for option "${name}"`);
    }

    return intVal;
}

/**
 * @return {Promise<boolean>}
 */
async function getOptionBool(name) {
    const val = await getOption(name);

    if (!['true', 'false'].includes(val)) {
        throw new Error(`Could not parse "${val}" into boolean for option "${name}"`);
    }

    return val === 'true';
}

async function setOption(name, value) {
    const option = await require('./repository').getOption(name);

    if (option) {
        option.value = value;

        await option.save();
    }
    else {
        await createOption(name, value, false);
    }
}

async function createOption(name, value, isSynced) {
    // to avoid circular dependency, need to find better solution
    const Option = require('../entities/option');

    await new Option({
        name: name,
        value: value,
        isSynced: isSynced
    }).save();
}

async function getOptions() {
    return await require('./repository').getEntities("SELECT * FROM options ORDER BY name");
}

async function getOptionsMap() {
    const options = await getOptions();

    return utils.toObject(options, opt => [opt.name, opt.value]);
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