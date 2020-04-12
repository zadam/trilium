const path = require('path');

module.exports = {
    mode: 'production',
    entry: {
        mobile: './src/public/javascripts/mobile.js',
    },
    output: {
        publicPath: '/dist/',
        path: path.resolve(__dirname, 'src/public/dist'),
        filename: 'mobile.js'
    },
    devtool: 'source-map'
};