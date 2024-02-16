function isDev() {
    return !!(process.env.TRILIUM_ENV && process.env.TRILIUM_ENV === 'dev');
}

export = {
    isDev
};