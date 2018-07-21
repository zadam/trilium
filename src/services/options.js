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

module.exports = {
    getOption,
    setOption,
    createOption
};