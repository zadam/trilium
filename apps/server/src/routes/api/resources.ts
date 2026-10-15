import type { ResourceDownloadProgress, ResourcesStatusResponse } from "@triliumnext/commons";
import { ValidationError } from "@triliumnext/core";
import type { Request } from "express";

import resources from "../../services/resources.js";

/** `GET /api/resources?ids=a,b`: whether each resource is installed, and the download that runs. */
function getStatus(req: Request): Promise<ResourcesStatusResponse> {
    return resources.getStatus(parseIds(req.query.ids));
}

/** `POST /api/resources/download` with `{ ids }`: starts downloading the resources not installed. */
function startDownload(req: Request): ResourceDownloadProgress {
    return resources.startDownload(parseIds(req.body?.ids));
}

/** `POST /api/resources/download/:downloadId/cancel`. */
function cancelDownload(req: Request<{ downloadId: string }>) {
    resources.cancelDownload(req.params.downloadId);
}

function parseIds(ids: unknown) {
    const list = typeof ids === "string" ? ids.split(",") : ids;
    if (!Array.isArray(list) || !list.length || !list.every((id) => typeof id === "string")) {
        throw new ValidationError("Expected a list of resource IDs.");
    }
    return list as string[];
}

export default {
    getStatus,
    startDownload,
    cancelDownload
};
