import type { FileId } from "@excalidraw/excalidraw/element/types";
import {
    CANVAS_ATTACHMENT_MIME, CANVAS_ATTACHMENT_TITLE, EMPTY_CANVAS_CONTENT, imageExtensionForMime,
    isAcceptedImageMime
} from "@triliumnext/commons";

import { t } from "../../../services/i18n";
import server from "../../../services/server";
import toast from "../../../services/toast";
import { randomString } from "../../../services/utils";

/**
 * Attaches to the note a canvas drawing that shows the image at `src`, locked at its natural size,
 * and answers with the ID of the drawing's attachment, or `null` once a toast tells that it failed.
 * The drawing refers to the image by file ID, so the image is attached again, titled with that ID.
 */
export async function convertImageToDrawing(noteId: string, src: string, componentId?: string) {
    try {
        const image = await fetchImage(src);
        const { width, height } = await getNaturalSize(image);
        const fileId = `${randomString(20)}.${imageExtensionForMime(image.type)}`;
        await upload(noteId, new File([ image ], fileId, { type: image.type }), componentId);

        const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
        const elements = convertToExcalidrawElements([ {
            type: "image",
            fileId: fileId as FileId,
            status: "saved",
            x: -width / 2,
            y: -height / 2,
            width,
            height,
            locked: true
        } ]);
        const content = JSON.stringify({ ...JSON.parse(EMPTY_CANVAS_CONTENT), elements });
        const drawing = new File([ content ], CANVAS_ATTACHMENT_TITLE, {
            type: CANVAS_ATTACHMENT_MIME
        });
        return await upload(noteId, drawing, componentId);
    } catch (e) {
        console.error(`Could not convert the image '${src}' to a drawing canvas`, e);
        toast.showError(t("image.cannot-convert-to-drawing"));
        return null;
    }
}

async function fetchImage(src: string) {
    const response = await fetch(src);
    const image = await response.blob();
    if (!response.ok || !isAcceptedImageMime(image.type)) {
        throw new Error(`Got ${response.status} '${image.type}' instead of an image.`);
    }
    return image;
}

async function getNaturalSize(image: Blob) {
    const url = URL.createObjectURL(image);
    try {
        const element = new Image();
        element.src = url;
        await element.decode();
        const { naturalWidth: width, naturalHeight: height } = element;
        if (!width || !height) {
            throw new Error("The image has no natural size.");
        }
        return { width, height };
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** Attaches `file` to the note as it is, and answers with the ID of the attachment. */
async function upload(noteId: string, file: File, componentId?: string) {
    const url = `notes/${noteId}/attachments/upload?link=true`;
    const response = await server.upload(url, file, componentId, "POST") as { url?: string };
    const attachmentId = response?.url?.match(/attachmentId=([A-Za-z0-9_]+)/)?.[1];
    if (!attachmentId) {
        throw new Error(`The upload of '${file.name}' was refused.`);
    }
    return attachmentId;
}
