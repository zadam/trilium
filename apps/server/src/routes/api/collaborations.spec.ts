import supertest from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import {
    type ApiTestContext, bootLoggedInApp, createTextNote
} from "../../../spec/support/internal_api.js";

const OPEN_VIEW = { includeSubtree: false, viewMode: "open", editMode: "none", createMode: "none" };
import { refreshAuth } from "../../services/auth.js";
import config from "../../services/config.js";

describe("collaborations API", () => {
    let ctx: ApiTestContext;
    let noteId: string;

    beforeAll(async () => {
        ctx = await bootLoggedInApp();
        noteId = (await createTextNote(ctx, { title: "collaborations api spec" })).noteId;
    });

    it("requires a logged-in session and a CSRF token", async () => {
        // The spec config runs without authentication; switch it on for this one check.
        const originalNoAuthentication = config.General.noAuthentication;
        config.General.noAuthentication = false;
        refreshAuth();

        try {
            await supertest(ctx.app).get("/api/collaborations").expect(401);
        } finally {
            config.General.noAuthentication = originalNoAuthentication;
            refreshAuth();
        }

        await ctx.agent
            .post("/api/collaborations")
            .send({ noteId, ...OPEN_VIEW })
            .expect(403);
    });

    it("creates, lists, updates and stops a collaboration and never returns a hash", async () => {
        const created = await ctx.agent
            .post("/api/collaborations")
            .set("x-csrf-token", ctx.csrfToken)
            .send({
                noteId,
                includeSubtree: true,
                viewMode: "open",
                editMode: "password",
                createMode: "none",
                editPassword: "secret-1"
            })
            .expect(200);

        const collabId = created.body.collabId as string;
        expect(collabId).toBeTruthy();
        expect(created.body.maxGuests).toBe(10);
        expect(created.body).toMatchObject({
            noteId,
            includeSubtree: true,
            viewMode: "open",
            editMode: "password",
            createMode: "none",
            slug: null
        });
        expect(JSON.stringify(created.body)).not.toMatch(/PasswordHash|PasswordSalt|secret-1/);

        const listed = await ctx.agent.get(`/api/collaborations?noteId=${noteId}`).expect(200);
        const listedIds = listed.body.map((collab: { collabId: string }) => collab.collabId);
        expect(listedIds).toEqual([ collabId ]);

        const patched = await ctx.agent
            .patch(`/api/collaborations/${collabId}`)
            .set("x-csrf-token", ctx.csrfToken)
            .send({
                includeSubtree: false,
                viewMode: "password",
                editMode: "none",
                createMode: "none",
                viewPassword: "view-1",
                slug: "spec-link"
            })
            .expect(200);
        expect(patched.body).toMatchObject({
            collabId,
            includeSubtree: false,
            viewMode: "password",
            editMode: "none",
            slug: "spec-link"
        });

        // A rule the service refuses comes back as 400 with its message.
        const refused = await ctx.agent
            .patch(`/api/collaborations/${collabId}`)
            .set("x-csrf-token", ctx.csrfToken)
            .send({
                includeSubtree: false,
                viewMode: "open",
                editMode: "open",
                createMode: "password",
                createPassword: "add-1"
            })
            .expect(400);
        expect(refused.body.message).toMatch(/child notes/);

        await ctx.agent.delete(`/api/collaborations/${collabId}`)
            .set("x-csrf-token", ctx.csrfToken)
            .expect(204);

        const afterStop = await ctx.agent.get(`/api/collaborations?noteId=${noteId}`).expect(200);
        expect(afterStop.body).toEqual([]);

        await ctx.agent
            .patch(`/api/collaborations/${collabId}`)
            .set("x-csrf-token", ctx.csrfToken)
            .send(OPEN_VIEW)
            .expect(404);
    });

    it("names the host and lists the collaborations a note is in", async () => {
        const parent = await createTextNote(ctx, { title: "scope parent" });
        const child = await createTextNote(ctx, { parentNoteId: parent.noteId, title: "child" });
        const outside = await createTextNote(ctx, { title: "scope outside" });
        const created = await ctx.agent
            .post("/api/collaborations")
            .set("x-csrf-token", ctx.csrfToken)
            .send({ noteId: parent.noteId, ...OPEN_VIEW, includeSubtree: true, hostName: " Ada " })
            .expect(200);
        expect(created.body.hostName).toBe("Ada");

        const inScopeOf = async (id: string) => (await ctx.agent.get("/api/collaborations")
            .query({ inScopeOf: id })
            .expect(200)).body.map((collab: { collabId: string }) => collab.collabId);
        expect(await inScopeOf(child.noteId)).toEqual([ created.body.collabId ]);
        expect(await inScopeOf(outside.noteId)).toEqual([]);
        expect(await inScopeOf("no-such-note")).toEqual([]);

        const renamed = await ctx.agent
            .patch(`/api/collaborations/${created.body.collabId}`)
            .set("x-csrf-token", ctx.csrfToken)
            .send({ ...OPEN_VIEW, includeSubtree: true, hostName: "" })
            .expect(200);
        expect(renamed.body.hostName).toBeNull();
    });

    it("refuses the root note and a missing note id", async () => {
        const refused = await ctx.agent
            .post("/api/collaborations")
            .set("x-csrf-token", ctx.csrfToken)
            .send({ noteId: "root", ...OPEN_VIEW })
            .expect(400);
        expect(refused.body.message).toMatch(/System notes/);

        await ctx.agent
            .post("/api/collaborations")
            .set("x-csrf-token", ctx.csrfToken)
            .send(OPEN_VIEW)
            .expect(400);
    });
});
