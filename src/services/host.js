const config = require('./config');
const env = require('./env');

let environmentHost;

if (process.env.TRILIUM_HOST) {
    environmentHost = process.env.TRILIUM_HOST;
}

module.exports = Promise.resolve(environmentHost || config['Network']['host'] || '0.0.0.0');
