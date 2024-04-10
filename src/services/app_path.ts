import assetPath = require('./asset_path');
import env = require('./env');

export = env.isDev()
    ? assetPath + "/app"
    : assetPath + "/app-dist";
