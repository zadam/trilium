"use strict";

const optionService = require('./options');
const config = require('./config');

/*
 * Primary configuration for sync is in the options (document), but we allow to override
 * these settings in config file. The reason for that is to avoid a mistake of loading a live/production
 * document with live sync settings in a dev/debug environment. Changes would then successfully propagate
 * to live sync server.
 */

async function get(name) {
    return config['Sync'][name] || await optionService.getOption(name);
}

module.exports = {
    getSyncServerHost: async () => await get('syncServerHost'),
    isSyncSetup: async () => !!await get('syncServerHost'),
    getSyncTimeout: async () => await get('syncServerTimeout'),
    getSyncProxy: async () => await get('syncProxy')
};