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
    return (config['Sync'] && config['Sync'][name]) || await optionService.getOption(name);
}

module.exports = {
    getSyncServerHost: async () => await get('syncServerHost'),
    isSyncSetup: async () => {
        const syncServerHost = await get('syncServerHost');

        // special value "disabled" is here to support use case where document is configured with sync server
        // and we need to override it with config from config.ini
        return !!syncServerHost && syncServerHost !== 'disabled';
    },
    getSyncTimeout: async () => parseInt(await get('syncServerTimeout')) || 60000,
    getSyncProxy: async () => await get('syncProxy')
};