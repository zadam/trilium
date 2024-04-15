import becca = require('../becca/becca');
import { OptionRow } from '../becca/entities/rows';
import sql = require('./sql');

function getOptionOrNull(name: string): string | null {
    let option;

    if (becca.loaded) {
        option = becca.getOption(name);
    } else {
        // e.g. in initial sync becca is not loaded because DB is not initialized
        option = sql.getRow<OptionRow>("SELECT * FROM options WHERE name = ?", [name]);
    }

    return option ? option.value : null;
}

function getOption(name: string) {
    const val = getOptionOrNull(name);

    if (val === null) {
        throw new Error(`Option '${name}' doesn't exist`);
    }

    return val;
}

function getOptionInt(name: string, defaultValue?: number): number {
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

function getOptionBool(name: string): boolean {
    const val = getOption(name);

    if (typeof val !== "string" || !['true', 'false'].includes(val)) {
        throw new Error(`Could not parse '${val}' into boolean for option '${name}'`);
    }

    return val === 'true';
}

function setOption(name: string, value: string | number | boolean) {
    if (value === true || value === false || typeof value === "number") {
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

function createOption(name: string, value: string | number, isSynced: boolean) {
    // to avoid circular dependency, need to find a better solution
    const BOption = require('../becca/entities/boption');

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
    const map: Record<string | number, string> = {};

    for (const option of Object.values(becca.options)) {
        map[option.name] = option.value;
    }

    return map;
}

export = {
    getOption,
    getOptionInt,
    getOptionBool,
    setOption,
    createOption,
    getOptions,
    getOptionMap,
    getOptionOrNull
};
