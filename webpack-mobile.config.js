const path = require('path');

module.exports = {
    mode: 'production',
    entry: {
        mobile: './src/public/app/mobile.js',
    },
    output: {
        publicPath: 'app-dist/',
        path: path.resolve(__dirname, 'src/public/app-dist'),
        filename: 'mobile.js'
    },
    devtool: 'source-map',
    target: 'electron-renderer'
};
