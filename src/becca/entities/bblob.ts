import { BlobRow } from "./rows";

class BBlob {
    static get entityName() { return "blobs"; }
    static get primaryKeyName() { return "blobId"; }
    static get hashedProperties() { return ["blobId", "content"]; }

    blobId: string;
    content: string | Buffer;
    contentLength: number;
    dateModified: string;
    utcDateModified: string;

    constructor(row: BlobRow) {
        this.blobId = row.blobId;
        this.content = row.content;
        this.contentLength = row.contentLength;
        this.dateModified = row.dateModified;
        this.utcDateModified = row.utcDateModified;
    }

    getPojo() {
        return {
            blobId: this.blobId,
            content: this.content,
            contentLength: this.contentLength,
            dateModified: this.dateModified,
            utcDateModified: this.utcDateModified
        };
    }
}

export = BBlob;
