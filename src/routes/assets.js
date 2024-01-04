const assetPath = require('../services/asset_path.js');
const path = require("path");
const express = require("express");
const env = require('../services/env.js');

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
    app.use(`/${assetPath}/images`, persistentCacheStatic(path.join(srcRoot, '..', 'images')));
    app.use(`/assets/vX/images`, express.static(path.join(srcRoot, '..', 'images')));
    app.use(`/${assetPath}/stylesheets`, persistentCacheStatic(path.join(srcRoot, 'public/stylesheets')));
    app.use(`/assets/vX/stylesheets`, express.static(path.join(srcRoot, 'public/stylesheets')));
    app.use(`/${assetPath}/libraries`, persistentCacheStatic(path.join(srcRoot, '..', 'libraries')));
    app.use(`/assets/vX/libraries`, express.static(path.join(srcRoot, '..', 'libraries')));

    // excalidraw-view mode in shared notes
    app.use(`/${assetPath}/node_modules/react/umd/react.production.min.js`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/react/umd/react.production.min.js')));
    app.use(`/${assetPath}/node_modules/react/umd/react.development.js`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/react/umd/react.development.js')));
    app.use(`/${assetPath}/node_modules/react-dom/umd/react-dom.production.min.js`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/react-dom/umd/react-dom.production.min.js')));
    app.use(`/${assetPath}/node_modules/react-dom/umd/react-dom.development.js`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/react-dom/umd/react-dom.development.js')));
    // expose the whole dist folder since complete assets are needed in edit and share
    app.use(`/node_modules/@excalidraw/excalidraw/dist/`, express.static(path.join(srcRoot, '..', 'node_modules/@excalidraw/excalidraw/dist/')));
    app.use(`/${assetPath}/node_modules/@excalidraw/excalidraw/dist/`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/@excalidraw/excalidraw/dist/')));

    // KaTeX
    app.use(
      `/${assetPath}/node_modules/katex/dist/katex.min.js`,
      persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/katex/dist/katex.min.js')));
    app.use(
      `/${assetPath}/node_modules/katex/dist/contrib/mhchem.min.js`,
      persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/katex/dist/contrib/mhchem.min.js')));
    app.use(
      `/${assetPath}/node_modules/katex/dist/contrib/auto-render.min.js`,
      persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/katex/dist/contrib/auto-render.min.js')));
    // expose the whole dist folder
    app.use(`/node_modules/katex/dist/`,
      express.static(path.join(srcRoot, '..', 'node_modules/katex/dist/')));
    app.use(`/${assetPath}/node_modules/katex/dist/`,
      persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/katex/dist/')));

    app.use(`/${assetPath}/node_modules/dayjs/`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/dayjs/')));
    app.use(`/${assetPath}/node_modules/force-graph/dist/`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/force-graph/dist/')));

    app.use(`/${assetPath}/node_modules/boxicons/css/`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/boxicons/css/')));
    app.use(`/${assetPath}/node_modules/boxicons/fonts/`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/boxicons/fonts/')));

    app.use(`/${assetPath}/node_modules/mermaid/dist/`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/mermaid/dist/')));

    app.use(`/${assetPath}/node_modules/jquery/dist/`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/jquery/dist/')));

    app.use(`/${assetPath}/node_modules/jquery-hotkeys/`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/jquery-hotkeys/')));

    app.use(`/${assetPath}/node_modules/print-this/`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/print-this/')));

    app.use(`/${assetPath}/node_modules/split.js/dist/`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/split.js/dist/')));

    app.use(`/${assetPath}/node_modules/panzoom/dist/`, persistentCacheStatic(path.join(srcRoot, '..', 'node_modules/panzoom/dist/')));
}

module.exports = {
    register
};
