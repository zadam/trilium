const config = require('./config.js');

module.exports = process.env.TRILIUM_HOST || config['Network']['host'] || '0.0.0.0';
