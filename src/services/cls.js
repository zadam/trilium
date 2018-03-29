const clsHooked = require('cls-hooked');
const namespace = clsHooked.createNamespace("trilium");

async function init(callback) {
    return await namespace.runAndReturn(callback);
}

function wrap(callback) {
    return async () => await init(callback);
}

module.exports = {
    init,
    wrap,
    namespace
};