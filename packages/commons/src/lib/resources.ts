/**
 * Resources are large files a feature needs at run time but that do not ship with the app, such as
 * the speech recognition model. The backend declares each one with its source and SHA-256, and
 * downloads it into the data directory on request; the client asks for resources by ID only.
 */

/** A resource as `GET /api/resources` reports it. */
export interface ResourceInfo {
    id: string;
    title: string;
    description: string;
    /** Boxicons classes, `bx bx-…`. */
    icon: string;
    /** The SPDX identifier of the license the resource is under, such as `CC-BY-4.0`. */
    license: string;
    /** The size of all its files, in bytes. */
    size: number;
    /** The bytes of its files already downloaded and verified, kept from an interrupted download. */
    downloadedSize: number;
    /** The host names its files are downloaded from. */
    sources: string[];
    installed: boolean;
    /** The directory holding its files while it is installed, else `null`. */
    directory: string | null;
}

/** How far a download has got with one of the resources it fetches. */
export interface ResourceDownloadState {
    id: string;
    receivedBytes: number;
    totalBytes: number;
    done: boolean;
}

/** A download as it runs, and as the `resource-download` WebSocket message reports it. */
export interface ResourceDownloadProgress {
    downloadId: string;
    resourceIds: string[];
    status: "downloading" | "succeeded" | "failed" | "canceled";
    receivedBytes: number;
    totalBytes: number;
    /** The name of the file being downloaded. */
    file: string | null;
    /** Why the download failed, when `status` is `failed`. */
    error?: string;
    /** Each resource the download fetches, in the order it fetches them. */
    resources: ResourceDownloadState[];
}

export interface ResourcesStatusResponse {
    resources: ResourceInfo[];
    /** The free space where resources are stored, in bytes, or `null` when it cannot be read. */
    freeBytes: number | null;
    /** The download that already fetches some of the resources, if one runs. */
    download: ResourceDownloadProgress | null;
}
