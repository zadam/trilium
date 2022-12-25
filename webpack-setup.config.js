const path = require('path');
const assetPath = require('./src/services/asset_path');

module.exports = {
    mode: 'production',
    entry: {
        mobile: './src/public/app/setup.js',
    },
    output: {
        publicPath: `${assetPath}/app-dist/`,
        path: path.resolve(__dirname, 'src/public/app-dist'),
        filename: 'setup.js'
    },
    devtool: 'source-map',
    target: 'electron-renderer'
};
