import { t } from "../../../services/i18n";
import server from "../../../services/server";
import toast from "../../../services/toast";
import { DEFAULT_NODE_IMAGE_WIDTH, fitNodeImage, measureImage, type NodeImage } from "./images";

/**
 * Uploads a picture to the note the map belongs to and describes it as a node carries it.
 *
 * The picture is stored as an attachment of the note, the way every other note type stores the
 * pictures written into it, and the node holds the address it is served back from — so the map's
 * own content stays the small piece of JSON it is however many pictures it grows.
 *
 * @returns what to hand to a node, or `null` if the picture could not be taken in — a message
 *          having been shown for it, as it is the whole of what the caller asked for.
 */
export async function uploadNodeImage(noteId: string, file: File): Promise<NodeImage | null> {
    const [ url, size ] = await Promise.all([ uploadImage(noteId, file), measureImage(file) ]);
    if (!url || !size) {
        // A file the browser will not read as a picture may have been stored all the same; nothing
        // points at it, so the next save takes it as an orphan and schedules its erasure.
        return null;
    }

    // Never larger than it came: a picture drawn past its own size is a blurred one, and the sizes
    // below are there for whoever does want it larger than it is.
    return fitNodeImage({ url, ...size }, Math.min(DEFAULT_NODE_IMAGE_WIDTH, size.width));
}

/**
 * The address a picture is served back from once the note holds it, or `null` with a message
 * shown.
 */
async function uploadImage(noteId: string, file: File): Promise<string | null> {
    let detail: string | undefined;

    try {
        const result = await server.upload(
            `notes/${noteId}/attachments/upload`,
            file, undefined, "POST"
        ) as { uploaded?: boolean; url?: string; message?: string };

        if (result?.uploaded && result.url) {
            return result.url;
        }
        detail = result?.message;
    } catch (e) {
        detail = e instanceof Error ? e.message : undefined;
    }

    const message = t("mind-map.image-upload-failed", { name: file.name });
    toast.showError(detail ? `${message} ${detail}` : message);
    return null;
}
