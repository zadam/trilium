const utils = require('./utils');

async function getOption(name) {
    const option = await require('./repository').getOption(name);

    if (!option) {
        throw new Error("Option " + name + " doesn't exist");
    }

    return option.value;
}

async function setOption(name, value) {
    const option = await require('./repository').getOption(name);

    if (!option) {
        throw new Error(`Option ${name} doesn't exist`);
    }

    option.value = value;

    await option.save();
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

async function getOptions(allowedOptions) {
    let options = await require('./repository').getEntities("SELECT * FROM options ORDER BY name");

    if (allowedOptions) {
        options = options.filter(opt => allowedOptions.includes(opt.name));
    }

    return options;
}

async function getOptionsMap(allowedOptions) {
    const options = await getOptions(allowedOptions);

    return utils.toObject(options, opt => [opt.name, opt.value]);
}

module.exports = {
    getOption,
    setOption,
    createOption,
    getOptions,
    getOptionsMap
};