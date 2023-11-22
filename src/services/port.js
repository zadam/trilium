const config = require('./config.js');
const utils = require('./utils.js');
const env = require('./env.js');
const dataDir = require('./data_dir.js');

function parseAndValidate(portStr, source) {
    const portNum = parseInt(portStr);

    if (isNaN(portNum) || portNum < 0 || portNum >= 65536) {
        console.log(`FATAL ERROR: Invalid port value "${portStr}" from ${source}, should be an integer between 0 and 65536.`);
        process.exit(-1);
    }

    return portNum;
}

let port;

if (process.env.TRILIUM_PORT) {
    port = parseAndValidate(process.env.TRILIUM_PORT, "environment variable TRILIUM_PORT");
} else if (utils.isElectron()) {
    port = env.isDev() ? 37740 : 37840;
} else {
    port = parseAndValidate(config['Network']['port'] || '3000', `Network.port in ${dataDir.CONFIG_INI_PATH}`);
}

module.exports = port;
