import { becca, cls, getSql } from "@triliumnext/core";
import { initShare, shaca } from "@triliumnext/core/src/share/index.js";
import { getShareProvider } from "@triliumnext/core/src/share/share_provider.js";
import supertest from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { type ApiTestContext, bootLoggedInApp } from "../../spec/support/internal_api.js";

// The fixture's "Shared notes" root and its "Child note", a text note; "Password protected share"
// carries #shareCredentials and "Shared Note Template" is a code note.
const ROOT = "y0AFOwgOgkWO";
const NOTE = "bKMn5EFv9KS2";
const LOCKED = "YjlPRj2E9fOV";
const CODE = "HAWgHNXXdzin";

const SESSION = `/share/api/edit/session?noteId=${NOTE}`;
const DATA = `/share/api/notes/${NOTE}/data`;

describe("share edit API", () => {
    let host: ApiTestContext;

    beforeAll(async () => {
        host = await bootLoggedInApp();
        // The share's read-only connection reads the fixture file under test, where the main
        // connection is in memory: shaca reads the main one here, so it sees the host's changes.
        const sql = getSql();
        initShare({
            ...getShareProvider(),
            sql: {
                getRawRows: <T>(query: string, params?: string[]) => sql.getRawRows(query, params) as T[],
                getRow: <T>(query: string, params?: string[]) => sql.getRow<T>(query, params),
                getColumn: <T>(query: string, params?: string[]) => sql.getColumn<T>(query, params)
            }
        });
        shaca.reset();
    });

    function setShareEdit(body: Record<string, unknown>) {
        return host.agent.put(`/api/notes/${ROOT}/share-edit`).set("x-csrf-token", host.csrfToken).send(body);
    }

    it("offers no editing until the host opens the subtree, with a password or openly", async () => {
        const guest = supertest.agent(host.app);
        await guest.get(SESSION).expect(200, { editable: false });
        await guest.get("/share/api/edit/session?noteId=nope").expect(404);
        await guest.get("/share/api/edit/session").expect(404);

        await setShareEdit({ enabled: true }).expect(400);
        await setShareEdit({ enabled: true, password: "abc" }).expect(400);
        // The labels land inside a transaction, whose commit sends them to the host's open
        // clients; the route is asynchronous, so no wrapper opens one for it.
        const sql = getSql();
        const runTransaction = sql.transactional.bind(sql);
        let writtenInTransaction = false;
        const transactional = vi.spyOn(sql, "transactional").mockImplementation((fn) => {
            const before = becca.getNoteOrThrow(ROOT).hasOwnedLabel("shareEdit");
            const result = runTransaction(fn);
            const after = becca.getNoteOrThrow(ROOT).hasOwnedLabel("shareEdit");
            writtenInTransaction ||= !before && after;
            return result;
        });
        await setShareEdit({ enabled: true, password: "secret1", attachments: false })
            .expect(200, { enabled: true, needsPassword: true, attachments: false });
        transactional.mockRestore();
        expect(writtenInTransaction).toBe(true);

        const session = await guest.get(SESSION).expect(200);
        expect(session.body).toMatchObject({
            editable: true, needsPassword: true, unlocked: false, rootNoteId: ROOT, attachments: false
        });
        expect(session.body.csrfToken).toBeUndefined();
        expect(session.body.strings.edit).toBeTruthy();

        // A code note is never edited by guests; a credential-protected note is not found without them.
        await guest.get(`/share/api/edit/session?noteId=${CODE}`).expect(200, { editable: false });
        await guest.get(`/share/api/edit/session?noteId=${LOCKED}`).expect(404);
        // The host's own session is unlocked without the password.
        const hostSession = await host.agent.get(SESSION).expect(200);
        expect(hostSession.body.unlocked).toBe(true);
        expect(hostSession.body.csrfToken).toBeTruthy();
    });

    it("unlocks with the password, saves with a CSRF token, refuses a stale save and logs out", async () => {
        const guest = supertest.agent(host.app);
        await guest.post("/share/api/edit/login").send({ noteId: NOTE, password: "wrong" }).expect(401);
        await guest.post("/share/api/edit/login").send({ noteId: NOTE }).expect(401);
        await guest.post("/share/api/edit/login").send({ noteId: CODE, password: "secret1" }).expect(403);
        await guest.put(DATA).send({ content: "<p>x</p>" }).expect(403);

        const login = await guest.post("/share/api/edit/login").send({ noteId: NOTE, password: "secret1" }).expect(200);
        const { csrfToken, version, payload } = login.body;
        expect(csrfToken).toBeTruthy();
        expect(version).toBe(becca.getNoteOrThrow(NOTE).blobId);
        expect(payload.notes.map((note: { noteId: string }) => note.noteId)).toEqual([ NOTE ]);
        expect(payload.options.textNoteEditorType).toBe("ckeditor-classic");
        expect(payload.assetPath).toMatch(/^\.\.\/assets\//);
        const session = await guest.get(SESSION).expect(200);
        expect(session.body.unlocked).toBe(true);
        expect(session.body.csrfToken).toBeTruthy();
        // An unlocked session opens the editor again without the password.
        const again = await guest.post("/share/api/edit/login").send({ noteId: NOTE }).expect(200);
        expect(again.body.csrfToken).toBeTruthy();

        const saved = await guest.put(DATA).set("x-csrf-token", csrfToken)
            .send({ content: "<p>Guest <script>alert(1)</script></p>", baseBlobId: version }).expect(200);
        expect(saved.body.blobId).not.toBe(version);
        const content = String(becca.getNoteOrThrow(NOTE).getContent());
        expect(content).toContain("<p>Guest ");
        expect(content).not.toContain("<script");

        const stale = await guest.put(DATA).set("x-csrf-token", csrfToken)
            .send({ content: "<p>Again</p>", baseBlobId: version }).expect(409);
        expect(stale.body.stale).toEqual({ blobId: saved.body.blobId });
        await guest.put(DATA).set("x-csrf-token", csrfToken).send({ content: 5 }).expect(400);
        await guest.put(DATA).set("x-csrf-token", csrfToken)
            .send({ content: "x".repeat(2 * 1024 * 1024 + 1) }).expect(413);

        await guest.put(`/share/api/notes/${NOTE}/title`).set("x-csrf-token", csrfToken)
            .send({ title: " Renamed by a guest " }).expect(200, { title: "Renamed by a guest" });
        await guest.put(`/share/api/notes/${NOTE}/title`).set("x-csrf-token", csrfToken)
            .send({ title: 5 }).expect(400);
        await guest.post(`/share/api/notes/${NOTE}/attachments/upload`).set("x-csrf-token", csrfToken)
            .attach("upload", Buffer.from("notes"), "notes.txt").expect(403);

        await guest.post("/share/api/edit/logout").set("x-csrf-token", csrfToken).send({ noteId: NOTE }).expect(204);
        await guest.put(DATA).set("x-csrf-token", csrfToken).send({ content: "<p>x</p>" }).expect(401);
    });

    it("stores an upload once attachments are allowed, and an open subtree needs no password", async () => {
        await setShareEdit({ enabled: true, open: true, attachments: true })
            .expect(200, { enabled: true, needsPassword: false, attachments: true });
        const guest = supertest.agent(host.app);
        const session = await guest.get(SESSION).expect(200);
        expect(session.body).toMatchObject({ needsPassword: false, unlocked: false, attachments: true });

        const { csrfToken } = (await guest.post("/share/api/edit/login").send({ noteId: NOTE }).expect(200)).body;
        const upload = await guest.post(`/share/api/notes/${NOTE}/attachments/upload`)
            .set("x-csrf-token", csrfToken).attach("upload", Buffer.from("notes"), "notes.txt").expect(200);
        const attachment = becca.getNoteOrThrow(NOTE).getAttachments().find((candidate) => candidate.title === "notes.txt");
        expect(upload.body).toEqual({ uploaded: true, url: `api/attachments/${attachment?.attachmentId}/download` });
        await guest.get(`/share/${upload.body.url}`).expect(200);
        await guest.post(`/share/api/notes/${NOTE}/attachments/upload`).set("x-csrf-token", csrfToken).expect(400);

        // A read-only note stays as it is, and closing the subtree ends the grant's use.
        cls.init(() => becca.getNoteOrThrow(NOTE).setLabel("readOnly"));
        await guest.put(DATA).set("x-csrf-token", csrfToken).send({ content: "<p>x</p>" }).expect(403);
        await guest.get(SESSION).expect(200, { editable: false });
        cls.init(() => becca.getNoteOrThrow(NOTE).removeLabel("readOnly"));

        await setShareEdit({ enabled: false }).expect(200, { enabled: false });
        await guest.get(SESSION).expect(200, { editable: false });
        await guest.put(DATA).set("x-csrf-token", csrfToken).send({ content: "<p>x</p>" }).expect(403);
        expect(becca.getNoteOrThrow(ROOT).getOwnedAttributes().map((attr) => attr.name)).not.toContain("shareEdit");
    });
});
