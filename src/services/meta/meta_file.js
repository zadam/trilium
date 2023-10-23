class MetaFile {
    /** @type {int} */
    formatVersion;
    /** @type {string} */
    appVersion;
    /** @type {NoteMeta[]} */
    files;

    save(archive, filePathPrefix = '') {
        const metaFileJson = JSON.stringify(this, null, '\t');

        archive.append(metaFileJson, { name: filePathPrefix + "!!!meta.json" });
    }
}

module.exports = MetaFile;
