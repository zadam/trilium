import { app_info as appInfo, becca, cls, date_utils as dateUtils, getLog, note_service as notes, options, password } from "@triliumnext/core";
import type { Application } from "express";
import supertest from "supertest";
import { generateConfig, Hotp } from "time2fa";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { refreshAuth } from "../services/auth.js";
import config from "../services/config.js";
import etapiTokens from "../services/etapi_tokens.js";
import recoveryCodes from "../services/encryption/recovery_codes.js";
import sql from "../services/sql.js";
import totp from "../services/totp.js";
import utils from "../services/utils.js";

// Exercise the vulnerable desktop/LAN posture as well as the shared server routes.
vi.mock("../services/utils.js", async (original) => ({ ...await original<object>(), isElectron: true }));

let app: Application;
const previousAuth = config.General.noAuthentication;
const previousLan = config.Security.allowLanAccess;

beforeAll(async () => {
    config.General.noAuthentication = false;
    config.Security.allowLanAccess = true;
    refreshAuth();
    app = await (await import("../app.js")).default();
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
    config.General.noAuthentication = previousAuth;
    config.Security.allowLanAccess = previousLan;
    refreshAuth();
});

describe("Grok security findings", () => {
    it("SEC-TRI-001: pairing asks for TOTP and never discloses a secret on password-only failure", async () => {
        vi.spyOn(totp, "isTotpEnabled").mockReturnValue(true);
        vi.spyOn(totp, "verifyTOTP").mockImplementation(code => code === "123456");
        vi.spyOn(recoveryCodes, "verifyRecoveryCode").mockReturnValue(false);
        const credential = Buffer.from("dummy:demo1234").toString("base64");
        for (const code of [undefined, "wrong"]) {
            const request = supertest(app).get("/api/setup/sync-seed").set("trilium-cred", credential);
            if (code) request.set("trilium-totp", code);
            const response = await request.expect(401);
            expect(response.text).not.toContain(options.getOption("documentSecret"));
        }
        const response = await supertest(app).get("/api/setup/sync-seed")
            .set("trilium-cred", credential).set("trilium-totp", "123456").expect(200);
        expect(response.body.options.some((option: { name: string }) => option.name === "documentSecret")).toBe(true);
    });

    it("SEC-TRI-001: a real TOTP pairing records its time step and refuses reuse", async () => {
        const snapshot = (["mfaMethod", "totpEncryptionSalt", "totpEncryptedSecret", "totpVerificationHash", "totpLastUsedStep"] as const)
            .map(name => ({ name, value: options.getOptionOrNull(name) ?? "" }));
        cls.init(() => {
            options.setOption("mfaMethod", "totp");
            totp.setSecret("JBSWY3DPEHPK3PXP");
        });
        try {
            const config = generateConfig();
            const code = Hotp.generatePasscode({ secret: "JBSWY3DPEHPK3PXP", counter: Math.floor(Date.now() / 1000 / config.period) }, config);
            const credential = Buffer.from("dummy:demo1234").toString("base64");
            await supertest(app).get("/api/setup/sync-seed").set("trilium-cred", credential).set("trilium-totp", code).expect(200);
            expect(Number(options.getOption("totpLastUsedStep"))).toBeGreaterThan(0);
            await supertest(app).get("/api/setup/sync-seed").set("trilium-cred", credential).set("trilium-totp", code).expect(401);
        } finally {
            cls.init(() => { for (const { name, value } of snapshot) options.setOption(name, value); });
        }
    });

    it("SEC-TRI-001/004/007: sync proof is scoped, header-bound and expires independently of the cookie", async () => {
        const agent = supertest.agent(app);
        const timestamp = dateUtils.utcNowDateTime();
        const login = await agent.post("/api/login/sync").send({
            timestamp, syncVersion: appInfo.syncVersion,
            hash: utils.hmac(options.getOption("documentSecret"), timestamp)
        }).expect(200);
        expect(login.body.syncToken).toBeTruthy();
        await agent.get("/api/notes/root").expect(401);
        await agent.get("/api/notes/root").set("trilium-sync-auth", login.body.syncToken).expect(401);
        await agent.get("/api/sync/stats").expect(401);
        await agent.get("/api/sync/stats").set("trilium-sync-auth", "wrong").expect(401);
        await agent.get("/api/sync/stats").set("trilium-sync-auth", login.body.syncToken).expect(200);
        await agent.post("/api/sync/check-entity-changes").set("trilium-sync-auth", login.body.syncToken).expect(204);
        await agent.post("/api/sync/force-full-sync").set("trilium-sync-auth", login.body.syncToken).expect(401);
        vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61 * 60 * 1000);
        await agent.get("/api/sync/stats").set("trilium-sync-auth", login.body.syncToken).expect(401);
    });

    it("SEC-TRI-004/007: browser sync writes need CSRF, stats need login", async () => {
        await supertest(app).get("/api/sync/stats").expect(401);
        const agent = supertest.agent(app);
        await agent.post("/login").send({ password: "demo1234" }).expect(302);
        const count = sql.getValue("SELECT COUNT(*) FROM notes");
        await agent.put("/api/sync/update").send({ entities: [] }).expect(403);
        for (const path of ["finished", "check-entity-changes", "queue-sector/notes/0"]) {
            await agent.post(`/api/sync/${path}`).send({}).expect(403);
        }
        expect(sql.getValue("SELECT COUNT(*) FROM notes")).toBe(count);
        const bootstrap = await agent.get("/bootstrap").expect(200);
        await agent.post("/api/sync/check-entity-changes").set("x-csrf-token", bootstrap.body.csrfToken).expect(204);
        await agent.get("/api/sync/stats").expect(200);
    });

    it("SEC-TRI-002: LAN access never authorizes the desktop clipper", async () => {
        const count = sql.getValue("SELECT COUNT(*) FROM notes");
        await supertest(app).post("/api/clipper/notes").send({ title: "untrusted", content: "x", labels: {} }).expect(401);
        expect(sql.getValue("SELECT COUNT(*) FROM notes")).toBe(count);
        const token = cls.init(() => etapiTokens.createToken("security clipper")).authToken;
        await supertest(app).get("/api/clipper/handshake").set("Authorization", token).expect(200);
        const response = await supertest(app).post("/api/clipper/notes").set("Authorization", token)
            .send({ title: "trusted clipping", content: "x", labels: {}, images: [] }).expect(200);
        expect(becca.getNote(response.body.noteId)?.title).toBe("trusted clipping");
    });

    it("SEC-TRI-005: custom publication needs an owned grant; private access accepts tokens and sessions", async () => {
        const note = cls.init(() => {
            const parent = notes.createNewNote({ parentNoteId: "root", title: "public parent", type: "text", content: "" }).note;
            parent.setLabel("customPublic");
            const note = notes.createNewNote({ parentNoteId: parent.noteId, title: "private resource", type: "text", content: "private bytes" }).note;
            note.setLabel("customResourceProvider", "security-resource");
            return note;
        });
        await supertest(app).get("/custom/security-resource").expect(401);
        const token = cls.init(() => etapiTokens.createToken("security custom")).authToken;
        await supertest(app).get("/custom/security-resource").set("Authorization", token).expect(200, "private bytes");
        const agent = supertest.agent(app);
        await agent.post("/login").send({ password: "demo1234" }).expect(302);
        await agent.get("/custom/security-resource").expect(200, "private bytes");
        await agent.post("/custom/security-resource").expect(403);
        cls.init(() => note.setLabel("customPublic", "false"));
        await supertest(app).get("/custom/security-resource").expect(401);
        cls.init(() => note.setLabel("customPublic"));
        await supertest(app).get("/custom/security-resource").expect(200, "private bytes");
    });

    it("SEC-TRI-003: first password and other claim paths require the console token", async () => {
        const log = vi.spyOn(getLog(), "info").mockImplementation(() => {});
        vi.spyOn(password, "isPasswordSet").mockReturnValue(false);
        const setPassword = vi.spyOn(password, "setPassword").mockResolvedValue({ success: true });
        const body = { password1: "safe-password", password2: "safe-password" };
        await supertest(app).post("/set-password").send(body).expect(401);
        expect(setPassword).not.toHaveBeenCalled();
        const message = log.mock.calls.map(call => String(call[0])).find(text => text.startsWith("First-run setup token"));
        const token = message?.split(": ").at(-1);
        expect(token).toMatch(/^[a-f0-9]{64}$/);
        for (const path of ["/api/setup/new-document", "/api/setup/sync-seed", "/api/setup/restore/start", "/api/login/sync"]) {
            await supertest(app).post(path).send({}).expect(401);
        }
        await supertest(app).post("/set-password").send({ ...body, setupToken: "é".repeat(64) }).expect(401);
        await supertest(app).post("/set-password").send({ ...body, setupToken: token }).expect(302);
        expect(setPassword).toHaveBeenCalledExactlyOnceWith("safe-password");
        vi.spyOn(password, "isPasswordSet").mockReturnValue(true);
        await supertest(app).post("/set-password").send({ ...body, setupToken: token }).expect(400);
        expect(setPassword).toHaveBeenCalledTimes(1);
    });
});
