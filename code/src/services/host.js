const config = require('./config');

module.exports = process.env.TRILIUM_HOST || config['Network']['host'] || '0.0.0.0';
