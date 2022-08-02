const config = require('./config');
const utils = require('./utils');
const env = require('./env');

if (process.env.TRILIUM_PORT) {
    module.exports = parseInt(process.env.TRILIUM_PORT);
    return;
}

if (utils.isElectron()) {
    module.exports = env.isDev() ? 37740 : 37840;
}
else {
    module.exports = config['Network']['port'] || '3000';
}
