const assetPath = require("./asset_path");
const env = require("./env");

module.exports = env.isDev()
    ? assetPath + "/app"
    : assetPath + "/app-dist";
