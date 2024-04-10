import AttributeMeta = require("./attribute_meta");

interface NoteMeta {
    noteId: string;
    notePath: string;
    isClone: boolean;
    title: string;
    notePosition: number;
    prefix: string;
    isExpanded: boolean;
    type: string;
    mime: string;
    /** 'html' or 'markdown', applicable to text notes only */
    format: "html" | "markdown";
    dataFileName: string;
    dirFileName: string;
    /** this file should not be imported (e.g., HTML navigation) */
    noImport: boolean;
    attributes: AttributeMeta[];
    attachments: AttributeMeta[];
    children?: NoteMeta[];
}

export = NoteMeta;
