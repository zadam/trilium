"use strict";

const optionService = require('./options');

module.exports = {
    getSyncServerHost: async () => await optionService.getOption('syncServerHost'),
    isSyncSetup: async () => !!await optionService.getOption('syncServerHost'),
    getSyncTimeout: async () => await optionService.getOption('syncServerTimeout'),
    getSyncProxy: async () => await optionService.getOption('syncProxy')
};