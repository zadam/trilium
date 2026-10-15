import { cls, getLog, password, password_encryption } from "@triliumnext/core";
import supertest from "supertest";
import { expect, it, vi } from "vitest";

import { refreshAuth } from "../services/auth.js";
import config from "../services/config.js";
import sqlInit from "../services/sql_init.js";
import setupApi from "@triliumnext/core/src/routes/api/setup.js";

it("SEC-TRI-003: only a console-token holder can persist the first password", async () => {
    const previous = config.General.noAuthentication;
    config.General.noAuthentication = false;
    refreshAuth();
    const log = vi.spyOn(getLog(), "info").mockImplementation(() => {});
    cls.init(() => password.resetPassword());
    try {
        const saveSeed = vi.spyOn(setupApi, "saveSyncSeed").mockResolvedValue(undefined);
        const app = await (await import("../app.js")).default();
        const body = { password1: "new-owner-password", password2: "new-owner-password" };
        const bootstrap = await supertest(app).get("/bootstrap").expect(200);
        expect(bootstrap.body.firstRunTokenRequired).toBe(true);
        await supertest(app).post("/set-password").send(body).expect(401);
        expect(password.isPasswordSet()).toBe(false);
        const token = log.mock.calls.map(call => String(call[0]))
            .find(message => message.startsWith("First-run setup token"))?.split(": ").at(-1);
        expect(token).toMatch(/^[a-f0-9]{64}$/);
        expect(JSON.stringify(bootstrap.body)).not.toContain(token);
        const initialized = vi.spyOn(sqlInit, "isDbInitialized").mockReturnValue(false);
        for (const path of ["/api/setup/sync-seed", "/API/SETUP/SYNC-SEED/", "/API/LOGIN/SYNC/"]) {
            await supertest(app).post(path).send({}).expect(401);
        }
        expect(saveSeed).not.toHaveBeenCalled();
        await supertest(app).get("/api/sync/stats").expect(401);
        await supertest(app).post("/API/SETUP/SYNC-SEED/").set("trilium-setup-auth", token ?? "").send({}).expect(204);
        expect(saveSeed).toHaveBeenCalledOnce();
        initialized.mockRestore();
        saveSeed.mockRestore();
        await supertest(app).post("/set-password").send({ ...body, setupToken: token }).expect(302);
        expect(password.isPasswordSet()).toBe(true);
        expect(await password_encryption.verifyPassword("new-owner-password")).toBe(true);
        await supertest(app).post("/set-password").send({ ...body, password1: "attacker", password2: "attacker" }).expect(302);
        expect(await password_encryption.verifyPassword("new-owner-password")).toBe(true);
    } finally {
        config.General.noAuthentication = previous;
        refreshAuth();
        vi.restoreAllMocks();
    }
});
