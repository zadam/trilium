module.exports = {
    isDev: function () {
        return !!(process.env.TRILIUM_ENV && process.env.TRILIUM_ENV === 'dev');
    }
};