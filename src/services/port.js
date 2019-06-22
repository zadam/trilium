const getPort = require('get-port');
const config = require('./config');
const utils = require('./utils');

if (utils.isElectron()) {
    module.exports = 53010;//getPort();
}
else {
    module.exports = Promise.resolve(config['Network']['port'] || '3000');
}