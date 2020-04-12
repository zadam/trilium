const path = require('path');

module.exports = {
    mode: 'production',
    entry: {
        mobile: './src/public/javascripts/desktop.js',
    },
    output: {
        publicPath: 'dist/',
        path: path.resolve(__dirname, 'src/public/dist'),
        filename: 'desktop.js'
    },
    devtool: 'source-map'
};