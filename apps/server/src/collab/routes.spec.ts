import { ws } from "@triliumnext/core";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import supertest from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
    type ApiTestContext, bootLoggedInApp, createTextNote
} from "../../spec/support/internal_api.js";
import { refreshAuth } from "../services/auth.js";
import config from "../services/config.js";
import sql from "../services/sql.js";

interface Fixture {
    rootNoteId: string;
    childNoteId: string;
    siblingNoteId: string;
}

const OPEN_VIEW = { includeSubtree: true, viewMode: "open", editMode: "none", createMode: "none" };

describe("collaboration guest routes", () => {
    let ctx: ApiTestContext;

    beforeAll(async () => {
        ctx = await bootLoggedInApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // A note holds one collaboration at a time, so every test gets its own tree.
    async function makeFixture(): Promise<Fixture> {
        const root = await createTextNote(ctx, {
            title: "Collab root title",
            content: "<p>Root body text</p>"
        });
        const child = await createTextNote(ctx, {
            parentNoteId: root.noteId,
            title: "Collab child title",
            content: "<p>Child body text</p>"
        });
        const sibling = await createTextNote(ctx, {
            title: "Collab sibling title",
            content: "<p>Sibling body text</p>"
        });

        return {
            rootNoteId: root.noteId,
            childNoteId: child.noteId,
            siblingNoteId: sibling.noteId
        };
    }

    async function createCollab(
        fixture: Fixture, settings: Record<string, unknown>
    ): Promise<string> {
        const res = await ctx.agent
            .post("/api/collaborations")
            .set("x-csrf-token", ctx.csrfToken)
            .send({ noteId: fixture.rootNoteId, ...settings })
            .expect(200);

        return res.body.collabId as string;
    }

    it("answers 404 for an unknown collaboration and redirects the bare id", async () => {
        await supertest(ctx.app).get("/collab/does-not-exist/").expect(404);
        await supertest(ctx.app).get("/collab/does-not-exist/api/tree")
            .expect(404)
            .expect("Content-Type", /json/);

        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, OPEN_VIEW);
        await supertest(ctx.app).get(`/collab/${collabId}`)
            .expect(302)
            .expect("Location", `${collabId}/`);
    });

    it("serves an open collaboration to anyone, scoped to the note and its subtree", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, OPEN_VIEW);
        const guest = supertest(ctx.app);

        const page = await guest.get(`/collab/${collabId}/`)
            .expect(200)
            .expect("X-Robots-Tag", "noindex");
        expect(page.text).toContain("Root body text");
        expect(page.text).toContain("Collab child title");
        expect(page.text).not.toContain("Collab sibling title");
        expect(page.text).not.toContain("../login");
        expect(page.text).not.toContain("shareJs");
        expect(page.text).toContain(`"capabilities":["view"]`);
        // The children the guest can see are cards under the body, with the start of their text.
        expect(page.text).toMatch(/class="collab-note-card[^"]*" data-note-id="[^"]+"/);
        expect(page.text).toMatch(/collab-note-card-title" href="\.\/[^"]+">Collab child title/);
        expect(page.text).toMatch(/collab-note-card-content[^>]*>[\s\S]*Child body text/);
        // A viewer's title row shows the note's icon without offering to change it.
        expect(page.text).toContain(`<span class="collab-note-icon`);
        expect(page.text).not.toContain(`<button type="button" class="collab-note-icon`);
        // Nothing on this collaboration can be unlocked, so no password form is offered.
        expect(page.text).not.toContain("collab-unlock");

        const childPage = await guest.get(`/collab/${collabId}/${fixture.childNoteId}`).expect(200);
        expect(childPage.text).toContain("Child body text");

        await guest.get(`/collab/${collabId}/${fixture.siblingNoteId}`).expect(404);
        await guest.get(`/collab/${collabId}/_hidden`).expect(404);
        await guest.get(`/collab/${collabId}/root`).expect(404);

        const tree = await guest.get(`/collab/${collabId}/api/tree`).expect(200);
        expect(tree.body.rootNoteId).toBe(fixture.rootNoteId);
        expect(JSON.stringify(tree.body)).toContain(fixture.childNoteId);
        expect(JSON.stringify(tree.body)).not.toContain(fixture.siblingNoteId);

        const note = await guest.get(`/collab/${collabId}/api/notes/${fixture.childNoteId}`)
            .expect(200);
        expect(note.body).toMatchObject({
            noteId: fixture.childNoteId,
            type: "text",
            content: "<p>Child body text</p>"
        });
        expect(note.body.blobId).toBeTruthy();

        await guest.get(`/collab/${collabId}/api/notes/${fixture.siblingNoteId}`).expect(404);
        await guest.get(`/collab/${collabId}/api/notes/${fixture.siblingNoteId}/download`)
            .expect(404);
        await guest.get(`/collab/${collabId}/api/images/${fixture.siblingNoteId}/image.png`)
            .expect(404);

        const download = await guest
            .get(`/collab/${collabId}/api/notes/${fixture.rootNoteId}/download`)
            .expect(200);
        expect(download.headers["content-disposition"]).toContain("attachment");
    });

    it("carries the page's state as JSON and keeps the contents button on every page", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, OPEN_VIEW);
        const headed = await createTextNote(ctx, {
            parentNoteId: fixture.rootNoteId,
            title: "Headed",
            content: "<h2>First</h2><p>One</p><h2>Second</h2><p>Two</p>"
        });
        // The state an in-place switch reads from a fetched page.
        const root = await supertest(ctx.app).get(`/collab/${collabId}/`).expect(200);
        expect(readBootstrap(root.text))
            .toMatchObject({ noteId: fixture.rootNoteId, capabilities: [ "view" ] });
        // Without headings the contents button is there but hidden, and there is no pane.
        expect(root.text).toMatch(/<button[^>]*id="toc-pane-toggle-button"[^>]*hidden/);
        expect(root.text).not.toContain(`id="toc-pane"`);

        const page = await supertest(ctx.app)
            .get(`/collab/${collabId}/${headed.noteId}`)
            .expect(200);
        expect(readBootstrap(page.text)).toMatchObject({ noteId: headed.noteId });
        expect(page.text).toMatch(/<button[^>]*id="toc-pane-toggle-button"[^>]*>/);
        expect(page.text).not.toMatch(/<button[^>]*id="toc-pane-toggle-button"[^>]*hidden/);
        expect(page.text).toContain(`id="toc-pane"`);
    });

    it("hands the page every string its scripts read", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, { ...OPEN_VIEW, editMode: "open" });
        const page = await supertest(ctx.app).get(`/collab/${collabId}/`).expect(200);
        const strings = readBootstrap(page.text).strings ?? {};

        const repo = join(import.meta.dirname, "../../../..");
        const scripts = [
            ...listScripts(join(repo, "packages/share-theme/src/scripts/modules"), /^collab/),
            join(repo, "apps/client/src/collab_editor.ts"),
            ...listScripts(join(repo, "apps/client/src/collab"))
        ];
        const read = new Set(scripts.flatMap((file) => [
            ...readFileSync(file, "utf8").matchAll(/\bstrings\.(\w+)/g)
        ].map((match) => match[1])));

        expect([ ...read ].filter((key) => !strings[key])).toEqual([]);
    });

    it("leaves the subtree out when it is not included", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, { ...OPEN_VIEW, includeSubtree: false });
        const guest = supertest(ctx.app);

        const page = await guest.get(`/collab/${collabId}/`).expect(200);
        expect(page.text).not.toContain("Collab child title");

        await guest.get(`/collab/${collabId}/${fixture.childNoteId}`).expect(404);

        const tree = await guest.get(`/collab/${collabId}/api/tree`).expect(200);
        expect(tree.body.tree).toBeNull();
    });

    it("asks for the view password, unlocks it and forgets it on logout", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, {
            ...OPEN_VIEW, viewMode: "password", viewPassword: "guest-secret"
        });
        const guest = supertest.agent(ctx.app);

        const prompt = await guest.get(`/collab/${collabId}/`).expect(401);
        expect(prompt.text).toContain('name="password"');
        expect(prompt.text).not.toContain("Collab root title");
        expect(prompt.text).not.toContain("Root body text");

        await guest.get(`/collab/${collabId}/api/tree`).expect(401).expect("Content-Type", /json/);

        const wrong = await guest.post(`/collab/${collabId}/login`)
            .type("form")
            .send({ password: "wrong" })
            .expect(401);
        expect(wrong.text).toContain("collab-login-error");

        await guest.post(`/collab/${collabId}/login`)
            .type("form")
            .send({ password: "guest-secret", returnTo: fixture.childNoteId })
            .expect(302)
            .expect("Location", `./${fixture.childNoteId}`);

        const page = await guest.get(`/collab/${collabId}/`).expect(200);
        expect(page.text).toContain("Root body text");
        expect(page.text).toContain(`"capabilities":["view"]`);
        // Logging out is an icon at the right of the page's header, not a link in the footer.
        const actions = page.text.slice(page.text.indexOf(`class="collab-header-actions"`));
        expect(actions).toMatch(/^[^]*?<form class="collab-logout"[^]*?collab-logout-button/);
        expect(page.text.match(/class="collab-logout"/g)).toHaveLength(1);

        // The guest session is not a host session. The spec config runs without authentication,
        // so switch it on for this one check.
        const originalNoAuthentication = config.General.noAuthentication;
        config.General.noAuthentication = false;
        refreshAuth();

        try {
            await guest.get(`/api/collaborations`).expect(401);
            await guest.get(`/api/notes/${fixture.rootNoteId}`).expect(401);
        } finally {
            config.General.noAuthentication = originalNoAuthentication;
            refreshAuth();
        }

        const csrfToken = page.text.match(/"csrfToken":"([^"]+)"/)?.[1] ?? "";
        expect(csrfToken).toBeTruthy();

        await guest.post(`/collab/${collabId}/logout`).type("form").send({}).expect(403);
        await guest.post(`/collab/${collabId}/logout`)
            .type("form")
            .send({ "x-csrf-token": csrfToken })
            .expect(302);
        await guest.get(`/collab/${collabId}/`).expect(401);
    });

    it("unlocks edit with its own password and reports the capabilities to the page", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, {
            ...OPEN_VIEW, editMode: "password", editPassword: "edit-secret"
        });
        const guest = supertest.agent(ctx.app);

        const before = await guest.get(`/collab/${collabId}/`).expect(200);
        expect(before.text).toContain(`"capabilities":["view"]`);
        // The page offers to enter the edit password, posting to the login route.
        expect(before.text).toContain("collab-unlock");
        expect(before.text).toContain('action="login"');

        const unlocked = await guest.post(`/collab/${collabId}/login`)
            .send({ password: "edit-secret" })
            .expect(200);
        expect(unlocked.body.capabilities).toEqual([ "view", "edit" ]);

        const after = await guest.get(`/collab/${collabId}/`).expect(200);
        expect(after.text).toContain(`"capabilities":["view","edit"]`);
        expect(after.text).not.toContain("collab-unlock");
    });

    it("takes either password at the view prompt, granting what it opens", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, {
            ...OPEN_VIEW,
            viewMode: "password", viewPassword: "view-secret",
            editMode: "password", editPassword: "edit-secret"
        });

        // The edit password opens editing and, with it, viewing.
        const editor = supertest.agent(ctx.app);
        await editor.get(`/collab/${collabId}/`).expect(401);
        await editor.post(`/collab/${collabId}/login`)
            .type("form").send({ password: "edit-secret" }).expect(302);
        const editorPage = await editor.get(`/collab/${collabId}/`).expect(200);
        expect(editorPage.text).toContain(`"capabilities":["view","edit"]`);

        // The view password opens viewing only; the prompt already took the one password the
        // guest has, so the page offers no second form.
        const viewer = supertest.agent(ctx.app);
        await viewer.post(`/collab/${collabId}/login`)
            .type("form").send({ password: "view-secret" }).expect(302);
        const viewerPage = await viewer.get(`/collab/${collabId}/`).expect(200);
        expect(viewerPage.text).toContain(`"capabilities":["view"]`);
        expect(viewerPage.text).not.toContain("collab-unlock");

        // A password that opens nothing is refused with the prompt's error.
        const stranger = supertest.agent(ctx.app);
        const refused = await stranger.post(`/collab/${collabId}/login`)
            .type("form")
            .send({ password: "nope" })
            .expect(401);
        expect(refused.text).toContain("collab-login-error");
        await stranger.get(`/collab/${collabId}/`).expect(401);
    });

    it("gives the host every capability and ends access when the collaboration stops", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, {
            ...OPEN_VIEW, viewMode: "password", viewPassword: "guest-secret"
        });

        const hostPage = await ctx.agent.get(`/collab/${collabId}/`).expect(200);
        expect(hostPage.text).toContain(`"capabilities":["view","edit","create"]`);

        await ctx.agent.delete(`/api/collaborations/${collabId}`)
            .set("x-csrf-token", ctx.csrfToken)
            .expect(204);

        await supertest(ctx.app).get(`/collab/${collabId}/`).expect(404);
        await ctx.agent.get(`/collab/${collabId}/`).expect(404);
    });

    it("lets an unlocked guest edit, refuses stale saves and strips scripts", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, {
            ...OPEN_VIEW, editMode: "password", editPassword: "edit-secret"
        });
        const guest = supertest.agent(ctx.app);
        await guest.post(`/collab/${collabId}/login`).send({ password: "edit-secret" }).expect(200);

        const page = await guest.get(`/collab/${collabId}/`).expect(200);
        const csrfToken = page.text.match(/"csrfToken":"([^"]+)"/)?.[1] ?? "";
        expect(csrfToken).toBeTruthy();
        expect(page.text).toContain(`"strings":{`);

        const noteUrl = `/collab/${collabId}/api/notes/${fixture.rootNoteId}`;
        const before = await guest.get(noteUrl).expect(200);

        await guest.put(`${noteUrl}/content`)
            .send({ content: "<p>x</p>", baseBlobId: before.body.blobId })
            .expect(403);

        const stale = await guest.put(`${noteUrl}/content`)
            .set("x-csrf-token", csrfToken)
            .send({ content: "<p>x</p>", baseBlobId: "not-the-blob" })
            .expect(409);
        expect(stale.body).toMatchObject({
            blobId: before.body.blobId,
            content: "<p>Root body text</p>"
        });

        const saved = await guest.put(`${noteUrl}/content`)
            .set("x-csrf-token", csrfToken)
            .send({
                content: "<p>Guest text</p><script>alert(1)</script>"
                    + "<img src=\"data:image/png;base64,AAAA\">",
                baseBlobId: before.body.blobId
            })
            .expect(200);
        expect(saved.body.blobId).toBeTruthy();
        expect(saved.body.blobId).not.toBe(before.body.blobId);

        const after = await guest.get(noteUrl).expect(200);
        expect(after.body.blobId).toBe(saved.body.blobId);
        expect(after.body.content).toContain("Guest text");
        expect(after.body.content).not.toContain("<script");
        expect(after.body.content).not.toContain("data:image");

        await guest.put(`${noteUrl}/title`)
            .set("x-csrf-token", csrfToken)
            .send({ title: "Guest title" })
            .expect(200);
        const renamed = await guest.get(`/collab/${collabId}/`).expect(200);
        expect(renamed.text).toContain("Guest title");

        await guest.put(`${noteUrl}/content`)
            .set("x-csrf-token", csrfToken)
            .send({ content: "a".repeat(2 * 1024 * 1024 + 1) })
            .expect(413);
        await guest.put(`${noteUrl}/content`)
            .set("x-csrf-token", csrfToken)
            .send({ content: 42 })
            .expect(400);
        await guest.put(`/collab/${collabId}/api/notes/${fixture.siblingNoteId}/content`)
            .set("x-csrf-token", csrfToken)
            .send({ content: "<p>x</p>" })
            .expect(404);
    });

    it("answers 401 for a password-gated capability and 403 otherwise", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, {
            ...OPEN_VIEW, editMode: "password", editPassword: "edit-secret"
        });
        const noteUrl = `/collab/${collabId}/api/notes/${fixture.rootNoteId}`;

        await supertest(ctx.app).put(`${noteUrl}/content`)
            .send({ content: "<p>x</p>" })
            .expect(401);
        await supertest(ctx.app).post(`${noteUrl}/children`).send({ title: "x" }).expect(403);

        const viewOnly = await makeFixture();
        const viewOnlyId = await createCollab(viewOnly, OPEN_VIEW);
        await supertest(ctx.app)
            .put(`/collab/${viewOnlyId}/api/notes/${viewOnly.rootNoteId}/content`)
            .send({ content: "<p>x</p>" })
            .expect(403);
    });

    it("lets a guest with the add password create a child note inside the scope", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, {
            ...OPEN_VIEW, editMode: "password", editPassword: "edit-secret",
            createMode: "password", createPassword: "add-secret"
        });

        const editor = supertest.agent(ctx.app);
        await editor.post(`/collab/${collabId}/login`)
            .send({ password: "edit-secret" })
            .expect(200);
        const editorPage = await editor.get(`/collab/${collabId}/`).expect(200);
        const editorToken = editorPage.text.match(/"csrfToken":"([^"]+)"/)?.[1] ?? "";
        const childrenUrl = `/collab/${collabId}/api/notes/${fixture.rootNoteId}/children`;
        await editor.post(childrenUrl)
            .set("x-csrf-token", editorToken)
            .send({ title: "Not allowed" })
            .expect(401);

        const adder = supertest.agent(ctx.app);
        const unlocked = await adder.post(`/collab/${collabId}/login`)
            .send({ password: "add-secret" })
            .expect(200);
        expect(unlocked.body.capabilities).toEqual([ "view", "edit", "create" ]);
        const adderPage = await adder.get(`/collab/${collabId}/`).expect(200);
        const adderToken = adderPage.text.match(/"csrfToken":"([^"]+)"/)?.[1] ?? "";

        const created = await adder.post(childrenUrl)
            .set("x-csrf-token", adderToken)
            .send({ title: "Added by guest" })
            .expect(200);
        expect(created.body).toMatchObject({ title: "Added by guest" });
        expect(created.body.noteId).toBeTruthy();

        const tree = await adder.get(`/collab/${collabId}/api/tree`).expect(200);
        expect(JSON.stringify(tree.body)).toContain(created.body.noteId);
        await adder.get(`/collab/${collabId}/${created.body.noteId}`).expect(200);

        await adder.post(`/collab/${collabId}/api/notes/${fixture.siblingNoteId}/children`)
            .set("x-csrf-token", adderToken)
            .send({ title: "Outside" })
            .expect(404);
    });

    it("lets an editor recolor and re-icon a note, and serves the icon packs", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, { ...OPEN_VIEW, editMode: "open" });
        const guest = supertest.agent(ctx.app);
        const page = await guest.get(`/collab/${collabId}/`).expect(200);
        const csrfToken = page.text.match(/"csrfToken":"([^"]+)"/)?.[1] ?? "";
        const url = `/collab/${collabId}/api/notes/${fixture.childNoteId}/appearance`;

        const set = await guest.put(url)
            .set("x-csrf-token", csrfToken)
            .send({ color: "#ff8800", iconClass: "bx bx-star" })
            .expect(200);
        expect(set.body).toEqual({ color: "#ff8800", iconClass: "bx bx-star" });

        const child = await guest.get(`/collab/${collabId}/${fixture.childNoteId}`).expect(200);
        expect(child.text).toContain(`data-color="#ff8800"`);
        // The title row tints the icon with the color's hue, as the app's title does.
        expect(child.text).toMatch(/class="collab-title-row" data-color="#ff8800" data-color-hue/);
        expect(child.text).toContain("bx bx-star");
        expect(child.text).toContain("collab-note-info");

        await guest.put(url)
            .set("x-csrf-token", csrfToken)
            .send({ color: "red; background: url(x)" })
            .expect(400);
        await guest.put(url)
            .set("x-csrf-token", csrfToken)
            .send({ iconClass: 42 })
            .expect(400);
        await guest.put(`/collab/${collabId}/api/notes/${fixture.siblingNoteId}/appearance`)
            .set("x-csrf-token", csrfToken)
            .send({ color: null })
            .expect(404);

        const icons = await guest.get(`/collab/${collabId}/api/icons`).expect(200);
        expect(icons.body.sources.length).toBeGreaterThan(0);
        expect(icons.body.sources[0].icons.length).toBeGreaterThan(10);
    });

    it("lets an editor switch a note between text and code, and a viewer not at all", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, { ...OPEN_VIEW, editMode: "open" });
        const guest = supertest.agent(ctx.app);
        const page = await guest.get(`/collab/${collabId}/`).expect(200);
        const csrfToken = page.text.match(/"csrfToken":"([^"]+)"/)?.[1] ?? "";
        expect(page.text).toContain(`"editable":true`);
        expect(page.text).toMatch(/"codeLanguages":\[\{"mime":"text\/plain"/);
        // The app's "…" for the note's options.
        expect(page.text).toContain("collab-note-options bx bx-dots-horizontal-rounded");

        const url = `/collab/${collabId}/api/notes/${fixture.childNoteId}/type`;
        const switched = await guest.put(url)
            .set("x-csrf-token", csrfToken)
            .send({ type: "code", mime: "text/x-python" })
            .expect(200);
        expect(switched.body).toEqual({ type: "code", mime: "text/x-python" });
        await guest.put(url)
            .set("x-csrf-token", csrfToken)
            .send({ type: "code", mime: "application/javascript;env=backend" })
            .expect(400);
        await guest.put(`/collab/${collabId}/api/notes/${fixture.siblingNoteId}/type`)
            .set("x-csrf-token", csrfToken)
            .send({ type: "code", mime: "text/plain" })
            .expect(404);

        const viewOnly = await createCollab(await makeFixture(), OPEN_VIEW);
        const viewer = await supertest(ctx.app).get(`/collab/${viewOnly}/`).expect(200);
        expect(viewer.text).toContain(`"codeLanguages":[]`);
        await supertest(ctx.app).put(`/collab/${viewOnly}/api/notes/${fixture.childNoteId}/type`)
            .send({ type: "code", mime: "text/plain" })
            .expect(403);
    });

    it("lets an editor draw a diagram and a canvas, storing the preview viewers see", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, { ...OPEN_VIEW, editMode: "open" });
        const guest = supertest.agent(ctx.app);
        const page = await guest.get(`/collab/${collabId}/`).expect(200);
        const csrfToken = page.text.match(/"csrfToken":"([^"]+)"/)?.[1] ?? "";
        const noteUrl = `/collab/${collabId}/api/notes/${fixture.childNoteId}`;
        const put = (path: string, body: object) =>
            guest.put(`${noteUrl}${path}`).set("x-csrf-token", csrfToken).send(body);

        await put("/type", { type: "mermaid", mime: "text/mermaid" }).expect(200);
        const diagram = await guest.get(noteUrl).expect(200);
        // As in the app, the content stays as it was until the guest edits it.
        expect(diagram.body.content).toBe("<p>Child body text</p>");

        await put("/content", {
            content: "graph TD; A-->B",
            baseBlobId: diagram.body.blobId,
            preview: "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script>"
                + "<rect width=\"4\" height=\"4\"/></svg>"
        }).expect(200);
        await put("/content", { content: "graph TD; A-->C", preview: 42 }).expect(400);

        // The page names the type as the app does, and the parent's card shows the picture.
        const diagramPage = await guest.get(`/collab/${collabId}/${fixture.childNoteId}`)
            .expect(200);
        expect(diagramPage.text).toMatch(/Type: Mermaid Diagram<\/span>/);
        const parentPage = await guest.get(`/collab/${collabId}/`).expect(200);
        expect(parentPage.text).toContain(`<img src="api/images/${fixture.childNoteId}/`);

        // A viewer sees the guest's preview, without the script.
        const image = await supertest(ctx.app)
            .get(`/collab/${collabId}/api/images/${fixture.childNoteId}/diagram.svg`)
            .expect(200);
        expect(image.headers["content-type"]).toContain("image/svg+xml");
        const svg = String(image.body);
        expect(svg).toContain("<rect");
        expect(svg).not.toContain("<script");

        await put("/type", { type: "canvas", mime: "application/json" }).expect(200);
        await put("/content", { content: "not json" }).expect(400);
        const scene = JSON.stringify({
            type: "excalidraw", version: 2, elements: [], files: {}, appState: {}
        });
        await put("/content", {
            content: scene,
            preview: "<svg xmlns=\"http://www.w3.org/2000/svg\"><circle r=\"1\"/></svg>"
        }).expect(200);
        expect((await guest.get(noteUrl).expect(200)).body.content).toBe(scene);

        // The canvas's pictures, less its own preview, for the guest's editor to load.
        await ctx.agent.post(`/api/notes/${fixture.childNoteId}/attachments`)
            .set("x-csrf-token", ctx.csrfToken)
            .send({ role: "image", mime: "image/png", title: "file-1", content: "png" })
            .expect(204);
        const pictures = await guest.get(`${noteUrl}/image-attachments`).expect(200);
        expect(pictures.body).toEqual([ { attachmentId: expect.any(String), title: "file-1" } ]);
        await guest.get(`/collab/${collabId}/api/notes/${fixture.siblingNoteId}/image-attachments`)
            .expect(404);

        await put("/type", { type: "book", mime: "" }).expect(200);
        await put("/content", { content: "" }).expect(400);
        await put("/type", { type: "render", mime: "" }).expect(400);
    });

    it("hands an anonymous open-edit guest a CSRF token and accepts the edit", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, { ...OPEN_VIEW, editMode: "open" });
        const guest = supertest.agent(ctx.app);

        const page = await guest.get(`/collab/${collabId}/`).expect(200);
        expect(page.text).toContain(`"capabilities":["view","edit"]`);
        expect(page.text).not.toContain("collab-logout");
        const csrfToken = page.text.match(/"csrfToken":"([^"]+)"/)?.[1] ?? "";
        expect(csrfToken).toBeTruthy();

        await guest.put(`/collab/${collabId}/api/notes/${fixture.rootNoteId}/content`)
            .set("x-csrf-token", csrfToken)
            .send({ content: "<p>Anonymous edit</p>" })
            .expect(200);

        const note = await guest.get(`/collab/${collabId}/api/notes/${fixture.rootNoteId}`)
            .expect(200);
        expect(note.body.content).toBe("<p>Anonymous edit</p>");
    });

    it("joins a viewer as a guest of their own, who keeps their name through unlocking",
        async () => {
            const fixture = await makeFixture();
            const collabId = await createCollab(fixture, {
                ...OPEN_VIEW, editMode: "password", editPassword: "edit-secret"
            });
            const guest = supertest.agent(ctx.app);
            const join = () => guest.post(`/collab/${collabId}/api/join`);

            // A viewer's page has no session, so it joins before it connects.
            const page = await guest.get(`/collab/${collabId}/`).expect(200);
            expect(readBootstrap(page.text)).toMatchObject({ selfId: null, csrfToken: null });
            expect(readGrant(collabId)).toBeNull();

            // Only the page's own script can join, never a form posted from elsewhere.
            await join().type("form").send({}).expect(415);
            const joined = await join().send({}).expect(200);
            expect(joined.body.selfId).toMatch(/^[A-Za-z0-9_-]{16}$/);
            expect(joined.body.csrfToken).toBeTruthy();
            const grant = readGrant(collabId);
            expect(grant).toMatchObject({ capabilities: [] });
            expect(joined.body.selfId).not.toContain(grant?.guestId);

            expect((await join().send({}).expect(200)).body.selfId).toBe(joined.body.selfId);
            const joinedPage = await guest.get(`/collab/${collabId}/`).expect(200);
            expect(readBootstrap(joinedPage.text).selfId).toBe(joined.body.selfId);

            const rename = vi.spyOn(ws, "renameCollabGuest");
            const renameSelf = (name: unknown, csrfToken: string) =>
                guest.put(`/collab/${collabId}/api/me`)
                    .set("x-csrf-token", csrfToken)
                    .send({ name });
            await guest.put(`/collab/${collabId}/api/me`).send({ name: "Grace" }).expect(403);
            expect((await renameSelf("  Grace \u202EHopper ", joined.body.csrfToken)
                .expect(200)).body).toEqual({ name: "Grace Hopper" });
            expect(readGrant(collabId))
                .toMatchObject({ guestId: grant?.guestId, name: "Grace Hopper" });
            expect(rename).toHaveBeenCalledWith(collabId, grant?.guestId, "Grace Hopper");

            // Unlocking editing keeps who the guest is.
            await guest.post(`/collab/${collabId}/login`)
                .send({ password: "edit-secret" })
                .expect(200);
            expect(readGrant(collabId)).toMatchObject({
                guestId: grant?.guestId, name: "Grace Hopper", capabilities: [ "edit" ]
            });

            // A blank name goes back to the numbered one. Unlocking gave the session a new id,
            // and with it the page a new token.
            const unlocked = await guest.get(`/collab/${collabId}/`).expect(200);
            expect((await renameSelf(" ", readBootstrap(unlocked.text).csrfToken)
                .expect(200)).body).toEqual({ name: null });
            expect(readGrant(collabId)?.name).toBeUndefined();
        });

    it("lets the host rename and remove a guest, who then needs the password again",
        async () => {
            const fixture = await makeFixture();
            const collabId = await createCollab(fixture, {
                ...OPEN_VIEW, viewMode: "password", viewPassword: "guest-secret"
            });
            const guest = supertest.agent(ctx.app);
            await guest.post(`/collab/${collabId}/login`)
                .send({ password: "guest-secret" })
                .expect(200);
            const guestId = readGrant(collabId)?.guestId ?? "";
            const page = await guest.get(`/collab/${collabId}/`).expect(200);
            const personId = readBootstrap(page.text).selfId as string;
            const people = `/api/collaborations/${collabId}/people`;
            const renamePerson = (id: string, name: unknown) => ctx.agent.put(`${people}/${id}`)
                .set("x-csrf-token", ctx.csrfToken)
                .send({ name });
            const removePerson = (id: string) => ctx.agent.delete(`${people}/${id}`)
                .set("x-csrf-token", ctx.csrfToken);

            // A guest is found by their id in the list only while their page is connected.
            await renamePerson(personId, "Grace").expect(404);
            vi.spyOn(ws, "findCollabGuestId").mockImplementation((id, person) =>
                (id === collabId && person === personId ? guestId : null));

            const rename = vi.spyOn(ws, "renameCollabGuest");
            await renamePerson(personId, "Grace").expect(204);
            expect(readGrant(collabId)).toMatchObject({ guestId, name: "Grace" });
            expect(rename).toHaveBeenCalledWith(collabId, guestId, "Grace");
            await renamePerson("someone-else", "Grace").expect(404);

            // The host's own entry is renamed through the collaboration, and never removed.
            await renamePerson("host", "Ada").expect(204);
            const listed = await ctx.agent.get("/api/collaborations")
                .query({ noteId: fixture.rootNoteId })
                .expect(200);
            expect(listed.body[0].hostName).toBe("Ada");
            await removePerson("host").expect(400);

            const remove = vi.spyOn(ws, "removeCollabGuest");
            await removePerson(personId).expect(204);
            expect(remove).toHaveBeenCalledWith(collabId, guestId);
            expect(readGrant(collabId)).toBeNull();
            expect((await guest.get(`/collab/${collabId}/`)).status).toBe(401);
        });

    it("refuses a removed guest's grant even when their session wrote it back", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, {
            ...OPEN_VIEW, viewMode: "password", viewPassword: "guest-secret"
        });
        const guest = supertest.agent(ctx.app);
        await guest.post(`/collab/${collabId}/login`)
            .send({ password: "guest-secret" })
            .expect(200);
        const guestId = readGrant(collabId)?.guestId ?? "";

        // As if a request of the guest's, in flight during the removal, saved its session.
        ws.removeCollabGuest(collabId, guestId);
        expect(readGrant(collabId)).toMatchObject({ guestId });

        expect((await guest.get(`/collab/${collabId}/`)).status).toBe(401);
        expect(readGrant(collabId)).toBeNull();
    });

    it("turns guests away with 503 while the collaboration is full, never the host", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, {
            ...OPEN_VIEW, editMode: "open", maxGuests: 1
        });
        const guest = supertest.agent(ctx.app);

        const page = await guest.get(`/collab/${collabId}/`).expect(200);
        const csrfToken = page.text.match(/"csrfToken":"([^"]+)"/)?.[1] ?? "";
        const noteUrl = `/collab/${collabId}/api/notes/${fixture.rootNoteId}`;

        const full = vi.spyOn(ws, "isCollabFull").mockReturnValue(true);

        const turnedAway = await guest.get(`/collab/${collabId}/`).expect(503);
        expect(turnedAway.headers["retry-after"]).toBe("30");
        expect(turnedAway.text).toContain("collab-retry");
        expect(turnedAway.text).not.toContain("Root body text");
        expect(full).toHaveBeenLastCalledWith(
            expect.objectContaining({ collabId, maxGuests: 1 }), expect.any(String));

        const refused = await guest.put(`${noteUrl}/content`)
            .set("x-csrf-token", csrfToken)
            .send({ content: "<p>no seat</p>" })
            .expect(503);
        expect(refused.body).toMatchObject({ full: true });

        await ctx.agent.get(`/collab/${collabId}/`).expect(200);
        await ctx.agent.put(`${noteUrl}/content`)
            .set("x-csrf-token", ctx.csrfToken)
            .send({ content: "<p>host edit</p>" })
            .expect(200);

        full.mockReturnValue(false);
        await guest.get(`/collab/${collabId}/`).expect(200);
    });

    it("adds an untitled child as the app does and serves the tree for refreshing", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, {
            ...OPEN_VIEW, editMode: "open", createMode: "password", createPassword: "add-secret"
        });
        const guest = supertest.agent(ctx.app);
        await guest.post(`/collab/${collabId}/login`).send({ password: "add-secret" }).expect(200);
        const page = await guest.get(`/collab/${collabId}/`).expect(200);
        const csrfToken = page.text.match(/"csrfToken":"([^"]+)"/)?.[1] ?? "";
        // An editor's title row offers to change the icon; the tree offers "+" on each row.
        expect(page.text).toContain(`<button type="button" class="collab-note-icon`);
        expect(page.text).toContain("collab-add-button");

        const childrenUrl = `/collab/${collabId}/api/notes/${fixture.rootNoteId}/children`;
        const created = await guest.post(childrenUrl)
            .set("x-csrf-token", csrfToken)
            .send({})
            .expect(200);
        expect(created.body.title).toBe("New note");
        await guest.post(childrenUrl)
            .set("x-csrf-token", csrfToken)
            .send({ title: 42 })
            .expect(400);

        const menu = await guest.get(`/collab/${collabId}/api/tree-menu`)
            .query({ active: created.body.noteId })
            .expect(200);
        expect(menu.body.html).toContain(`href="./${created.body.noteId}"`);
        expect(menu.body.html)
            .toMatch(new RegExp(`class="[^"]*active[^"]*" href="./${created.body.noteId}"`));
        expect(menu.body.html).not.toContain(fixture.siblingNoteId);
        expect(menu.body).toMatchObject({ color: null, hasHue: false });
        expect(menu.body.iconClass).toContain("bx bx-note");

        await guest.get(`/collab/${collabId}/api/tree-menu`)
            .query({ active: fixture.siblingNoteId })
            .expect(404);

        // Without `active`, the root's own children come as cards, the new note's among them.
        const rootMenu = await guest.get(`/collab/${collabId}/api/tree-menu`).expect(200);
        expect(rootMenu.body.childrenHtml).toContain(`data-note-id="${created.body.noteId}"`);
        expect(rootMenu.body.childrenHtml).toContain(`data-note-id="${fixture.childNoteId}"`);
        expect(rootMenu.body.childrenHtml).not.toContain(fixture.siblingNoteId);

    });

    it("rate limits password guessing", async () => {
        const fixture = await makeFixture();
        const collabId = await createCollab(fixture, {
            ...OPEN_VIEW, viewMode: "password", viewPassword: "guest-secret"
        });
        const guest = supertest(ctx.app);

        let lastStatus = 0;
        for (let attempt = 0; attempt < 12; attempt++) {
            const res = await guest.post(`/collab/${collabId}/login`)
                .type("form")
                .send({ password: "wrong" });
            lastStatus = res.status;
            if (lastStatus === 429) {
                break;
            }
            expect(lastStatus).toBe(401);
        }

        expect(lastStatus).toBe(429);
    });
});

/** The scripts under `dir`, specs left out, whose names match `name`. */
function readBootstrap(html: string) {
    const json = html.match(
        /<script type="application\/json" id="collab-bootstrap">([^<]*)<\/script>/)?.[1];

    return JSON.parse(json ?? "null");
}

/** The grant a stored session holds on the collaboration, which each test gives one guest. */
function readGrant(collabId: string) {
    for (const { data } of sql.getRows<{ data: string }>("SELECT data FROM sessions")) {
        const grant = JSON.parse(data)?.collab?.[collabId];

        if (grant) {
            return grant as { guestId: string; capabilities: string[]; name?: string };
        }
    }

    return null;
}

function listScripts(dir: string, name = /./): string[] {
    return readdirSync(dir, { recursive: true, encoding: "utf8" })
        .filter((file) => /\.tsx?$/.test(file) && !/\.spec\./.test(file) && name.test(file))
        .map((file) => join(dir, file));
}
