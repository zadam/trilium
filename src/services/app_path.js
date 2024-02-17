const assetPath = require('./asset_path.js');
const env = require('./env');

module.exports = env.isDev()
    ? assetPath + "/app"
    : assetPath + "/app-dist";
