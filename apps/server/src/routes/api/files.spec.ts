import { CANVAS_ATTACHMENT_MIME } from "@triliumnext/commons";
import { becca, cls, note_service as noteService, ValidationError } from "@triliumnext/core";
import type { Request } from "express";
import fs from "fs";
import { beforeAll, describe, expect, it } from "vitest";

import filesRoute from "./files.js";

let noteId: string;
let attachmentId: string;

function fileReq(params: Record<string, string>, file?: unknown, query: Record<string, string> = {}, body: Record<string, unknown> = {}) {
    return { params, file, query, body } as unknown as Request<{ noteId: string }>;
}

describe("Files API", () => {
    beforeAll(() => {
        cls.init(() => {
            const { note } = noteService.createNewNote({
                parentNoteId: "root", title: "File note", type: "file", mime: "text/plain", content: "original"
            });
            noteId = note.noteId;
            const attachment = note.saveAttachment({ role: "file", mime: "text/plain", title: "att.txt", content: "att-data" });
            attachmentId = attachment.attachmentId;
        });
    });

    describe("temp-dir round trip", () => {
        it("saves a note to a temp file then uploads the modified content back", () => {
            const { tmpFilePath } = cls.init(() => filesRoute.saveNoteToTmpDir(fileReq({ noteId })));
            expect(fs.existsSync(tmpFilePath)).toBe(true);

            fs.writeFileSync(tmpFilePath, "edited-on-disk");
            cls.init(() => filesRoute.uploadModifiedFileToNote(fileReq({ noteId }, undefined, {}, { filePath: tmpFilePath })));
            expect(becca.getNoteOrThrow(noteId).getContent()).toBe("edited-on-disk");
        });

        it("saves an attachment to a temp file then uploads it back", () => {
            const req = fileReq({ attachmentId } as Record<string, string>) as unknown as Request<{ attachmentId: string }>;
            const { tmpFilePath } = cls.init(() => filesRoute.saveAttachmentToTmpDir(req));
            fs.writeFileSync(tmpFilePath, "edited-att");
            const uploadReq = fileReq({ attachmentId } as Record<string, string>, undefined, {}, { filePath: tmpFilePath }) as unknown as Request<{ attachmentId: string }>;
            cls.init(() => filesRoute.uploadModifiedFileToAttachment(uploadReq));
            expect(becca.getAttachmentOrThrow(attachmentId).getContent()).toBe("edited-att");
        });

        it("saves a canvas drawing to a temp file with the images it refers to inside", () => {
            const drawing = cls.init(() => {
                const { note } = noteService.createNewNote({
                    parentNoteId: "root", title: "Drawing note", type: "text", content: "<p>x</p>"
                });
                note.saveAttachment({
                    role: "image", mime: "image/png", title: "f1.png", content: "abc"
                });
                return note.saveAttachment({
                    role: "file",
                    mime: CANVAS_ATTACHMENT_MIME,
                    title: "Canvas.excalidraw",
                    content: JSON.stringify({ elements: [ { type: "image", fileId: "f1.png" } ] })
                });
            });
            const req = fileReq({ attachmentId: drawing.attachmentId ?? "" });

            const { tmpFilePath } = cls.init(() => filesRoute.saveAttachmentToTmpDir(
                req as unknown as Request<{ attachmentId: string }>));

            const scene = JSON.parse(fs.readFileSync(tmpFilePath, "utf8"));
            expect(scene.files?.["f1.png"]?.dataURL).toBe("data:image/png;base64,YWJj");
        });

        it("rejects uploading from an unknown temp path", () => {
            expect(() => cls.init(() => filesRoute.uploadModifiedFileToNote(
                fileReq({ noteId }, undefined, {}, { filePath: "/not/a/temp/file" })
            ))).toThrow(ValidationError);
            const req = fileReq({ attachmentId } as Record<string, string>, undefined, {}, { filePath: "/nope" }) as unknown as Request<{ attachmentId: string }>;
            expect(() => cls.init(() => filesRoute.uploadModifiedFileToAttachment(req))).toThrow(ValidationError);
        });
    });
});
