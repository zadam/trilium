"use strict";

const optionService = require('./options');
const config = require('./config');

/*
 * Primary configuration for sync is in the options (document), but we allow to override
 * these settings in config file. The reason for that is to avoid a mistake of loading a live/production
 * document with live sync settings in a dev/debug environment. Changes would then successfully propagate
 * to live sync server.
 */

function get(name) {
    return (config['Sync'] && config['Sync'][name]) || optionService.getOption(name);
}

module.exports = {
    // env variable is the easiest way to guarantee we won't overwrite prod data during development
    // after copying prod document/data directory
    getSyncServerHost: () => process.env.TRILIUM_SYNC_SERVER_HOST || get('syncServerHost'),
    isSyncSetup: () => {
        const syncServerHost = get('syncServerHost');

        // special value "disabled" is here to support use case where document is configured with sync server,
        // and we need to override it with config from config.ini
        return !!syncServerHost && syncServerHost !== 'disabled';
    },
    getSyncTimeout: () => parseInt(get('syncServerTimeout')) || 120000,
    getSyncProxy: () => get('syncProxy')
};
