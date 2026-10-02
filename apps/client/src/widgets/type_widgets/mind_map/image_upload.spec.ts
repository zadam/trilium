import { beforeEach, describe, expect, it, vi } from "vitest";

import server from "../../../services/server";
import toast from "../../../services/toast";
import { uploadNodeImage } from "./image_upload";
import { DEFAULT_NODE_IMAGE_WIDTH, measureImage } from "./images";

vi.mock("../../../services/server", () => ({ default: { upload: vi.fn() } }));
vi.mock("../../../services/toast", () => ({ default: { showError: vi.fn() } }));
// No test environment decodes pictures, so the size a picture comes in is given here.
vi.mock("./images", async (importOriginal) => ({
    ...await importOriginal<typeof import("./images")>(),
    measureImage: vi.fn()
}));

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(measureImage).mockResolvedValue({ width: 800, height: 600 });
});

describe("uploadNodeImage", () => {
    const file = new File([ "" ], "photo.png", { type: "image/png" });
    const uploaded = { uploaded: true, url: "api/attachments/att1/image/photo.png" };

    it("stores the picture on the note and hands it back at a size a node can wear", async () => {
        vi.mocked(server.upload).mockResolvedValue(uploaded);

        expect(await uploadNodeImage("mapNote", file)).toEqual({
            url: "api/attachments/att1/image/photo.png",
            width: DEFAULT_NODE_IMAGE_WIDTH,
            height: DEFAULT_NODE_IMAGE_WIDTH * 600 / 800
        });
        expect(server.upload).toHaveBeenCalledWith(
            "notes/mapNote/attachments/upload", file, undefined, "POST");
    });

    it("never draws a picture larger than it came", async () => {
        vi.mocked(measureImage).mockResolvedValue({ width: 64, height: 32 });
        vi.mocked(server.upload).mockResolvedValue(uploaded);

        expect(await uploadNodeImage("mapNote", file)).toMatchObject({ width: 64, height: 32 });
    });

    it("says what went wrong when the note refuses it, and gives the node nothing", async () => {
        vi.mocked(server.upload).mockResolvedValue({ uploaded: false, message: "Too large." });
        expect(await uploadNodeImage("mapNote", file)).toBeNull();
        expect(vi.mocked(toast.showError).mock.calls[0][0]).toContain("Too large.");

        vi.mocked(server.upload).mockRejectedValue(new Error("Offline."));
        expect(await uploadNodeImage("mapNote", file)).toBeNull();
        expect(vi.mocked(toast.showError).mock.calls[1][0]).toContain("Offline.");

        // A file that is no picture is refused as well, whatever the note made of it.
        vi.mocked(measureImage).mockResolvedValue(null);
        vi.mocked(server.upload).mockResolvedValue(uploaded);
        expect(await uploadNodeImage("mapNote", file)).toBeNull();
    });
});
