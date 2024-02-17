import config = require('./config');
import utils = require('./utils');
import env = require('./env');
import dataDir = require('./data_dir');

function parseAndValidate(portStr: string, source: string) {
    const portNum = parseInt(portStr);

    if (isNaN(portNum) || portNum < 0 || portNum >= 65536) {
        console.log(`FATAL ERROR: Invalid port value "${portStr}" from ${source}, should be an integer between 0 and 65536.`);
        process.exit(-1);
    }

    return portNum;
}

let port: number;

if (process.env.TRILIUM_PORT) {
    port = parseAndValidate(process.env.TRILIUM_PORT, "environment variable TRILIUM_PORT");
} else if (utils.isElectron()) {
    port = env.isDev() ? 37740 : 37840;
} else {
    port = parseAndValidate(config['Network']['port'] || '3000', `Network.port in ${dataDir.CONFIG_INI_PATH}`);
}

export = port;
