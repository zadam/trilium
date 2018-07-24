"use strict";

const optionService = require('./options');

module.exports = {
    getSyncServer: async () => await optionService.getOption('syncServerHost'),
    isSyncSetup: async () => !!await optionService.getOption('syncServerHost'),
    getSyncTimeout: async () => await optionService.getOption('syncServerTimeout'),
    getSyncProxy: async () => await optionService.getOption('syncProxy')
};