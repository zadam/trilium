const assetPath = require("../services/asset_path");
const path = require("path");
const express = require("express");
const env = require("../services/env");

const persistentCacheStatic = (root, options) => {
    if (!env.isDev()) {
        options = {
            maxAge: '1y',
            ...options
        };
    }
    return express.static(root, options);
};

function register(app) {
    const srcRoot = path.join(__dirname, '..');
    app.use(`/${assetPath}/app`, persistentCacheStatic(path.join(srcRoot, 'public/app')));
    app.use(`/${assetPath}/app-dist`, persistentCacheStatic(path.join(srcRoot, 'public/app-dist')));
    app.use(`/${assetPath}/fonts`, persistentCacheStatic(path.join(srcRoot, 'public/fonts')));
    app.use(`/assets/vX/fonts`, express.static(path.join(srcRoot, 'public/fonts')));
    app.use(`/${assetPath}/stylesheets`, persistentCacheStatic(path.join(srcRoot, 'public/stylesheets')));
    app.use(`/assets/vX/stylesheets`, express.static(path.join(srcRoot, 'public/stylesheets')));
    app.use(`/${assetPath}/libraries`, persistentCacheStatic(path.join(srcRoot, '..', 'libraries')));
    app.use(`/assets/vX/libraries`, express.static(path.join(srcRoot, '..', 'libraries')));
    // excalidraw-view mode in shared notes
    app.use(`/${assetPath}/node_modules/react/umd/react.production.min.js`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/react/umd/react.production.min.js')));
    app.use(`/${assetPath}/node_modules/react-dom/umd/react-dom.production.min.js`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/react-dom/umd/react-dom.production.min.js')));
    // expose the whole dist folder since complete assets are needed in edit and share
    app.use(`/node_modules/@excalidraw/excalidraw/dist/`, express.static(path.join(srcRoot, '..', 'node_modules/@excalidraw/excalidraw/dist/')));
    app.use(`/${assetPath}/node_modules/@excalidraw/excalidraw/dist/`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/@excalidraw/excalidraw/dist/')));
    app.use(`/${assetPath}/images`, persistentCacheStatic(path.join(srcRoot, '..', 'images')));
    app.use(`/assets/vX/images`, express.static(path.join(srcRoot, '..', 'images')));
}

module.exports = {
    register
};
