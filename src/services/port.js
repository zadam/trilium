const config = require('./config');
const utils = require('./utils');
const env = require('./env');
const portscanner = require('portscanner');

let environmentPort;

if (process.env.TRILIUM_PORT) {
    environmentPort = parseInt(process.env.TRILIUM_PORT);
}

if (utils.isElectron()) {
    module.exports = new Promise((resolve, reject) => {
        const startingPort = environmentPort || (env.isDev() ? 37740 : 37840);

        portscanner.findAPortNotInUse(startingPort, startingPort + 10, '127.0.0.1', function(error, port) {
            if (error) {
                reject(error);
            }
            else {
                resolve(port);
            }
        })
    });
}
else {
    module.exports = Promise.resolve(environmentPort || config['Network']['port'] || '3000');
}