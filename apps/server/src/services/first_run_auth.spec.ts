import { getLog, password } from "@triliumnext/core";
import express from "express";
import supertest from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import config from "./config.js";
import { markAsInternalElectronRequest } from "./electron_request.js";
import { checkFirstRunAuth, initializeFirstRunAuth } from "./first_run_auth.js";

afterEach(() => vi.restoreAllMocks());

describe("SEC-TRI-003: console proof", () => {
    it("expires the token, renews it in the console, and exempts only the trusted renderer or explicit no-auth mode", async () => {
        const previous = config.General.noAuthentication;
        config.General.noAuthentication = false;
        vi.spyOn(password, "isPasswordSet").mockReturnValue(false);
        const log = vi.spyOn(getLog(), "info").mockImplementation(() => {});
        const app = express();
        app.use(express.json());
        app.post("/", checkFirstRunAuth, (_req, res) => res.sendStatus(204));
        app.post("/internal", (req, _res, next) => { markAsInternalElectronRequest(req); next(); }, checkFirstRunAuth,
            (_req, res) => res.sendStatus(204));
        const latestToken = () => log.mock.calls.map(call => String(call[0]))
            .filter(message => message.startsWith("First-run setup token")).at(-1)?.split(": ").at(-1) ?? "";
        try {
            initializeFirstRunAuth();
            const initial = latestToken();
            expect(initial).toMatch(/^[a-f0-9]{64}$/);
            await supertest(app).post("/").send({ setupToken: initial }).expect(204);
            await supertest(app).post("/internal").send({}).expect(204);
            await supertest(app).post("/").send({}).expect(401);
            const now = Date.now();
            const clock = vi.spyOn(Date, "now").mockReturnValue(now + 61 * 60 * 1000);
            await supertest(app).post("/").send({ setupToken: initial }).expect(401);
            const renewed = latestToken();
            expect(renewed).not.toBe(initial);
            await supertest(app).post("/").set("trilium-setup-auth", renewed).expect(204);
            clock.mockRestore();
            config.General.noAuthentication = true;
            await supertest(app).post("/").send({}).expect(204);
        } finally {
            config.General.noAuthentication = previous;
        }
    });
});
