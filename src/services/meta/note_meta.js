class NoteMeta {
    /** @type {string} */
    noteId;
    /**
     * @type {string[]}
     * @deprecated unused as of v3
     */
    notePath;
    /** @type {boolean} */
    isClone;
    /** @type {string} */
    title;
    /** @type {int} */
    notePosition;
    /** @type {string} */
    prefix;
    /** @type {boolean} */
    isExpanded;
    /** @type {string} */
    type;
    /** @type {string} */
    mime;
    /** @type {string} - 'html' or 'markdown', applicable to text notes only */
    format;
    /** @type {string} */
    dataFileName;
    /** @type {string} */
    dirFileName;
    /** @type {boolean} - this file should not be imported (e.g., HTML navigation) */
    noImport = false;
    /** @type {AttributeMeta[]} */
    attributes;
    /** @type {AttachmentMeta[]} */
    attachments;
    /**
     * @type {NoteMeta[]|undefined}
     * @deprecated unused as of v3, there's meta file for each directory, avoiding the need to use this
     */
    children;
}

module.exports = NoteMeta;
