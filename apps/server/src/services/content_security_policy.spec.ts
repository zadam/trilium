import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import express from "express";
import supertest from "supertest";
import { describe, expect, it } from "vitest";

import { APP_BOOT_SCRIPT_HASH, contentSecurityPolicy } from "./content_security_policy.js";

// The hash must stay in sync with the exact bytes the browser receives from the static shell.
// A markup-only edit otherwise silently disables this required boot script.
describe("SEC-TRI-008: application CSP", () => {
    it("allows the fixed boot shim by hash and issues a unique nonce without permitting inline script attributes", async () => {
        const html = readFileSync("../client/index.html", "utf8");
        const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
        expect(inline).toHaveLength(1);
        expect(APP_BOOT_SCRIPT_HASH).toBe(`'sha256-${createHash("sha256").update(inline[0][1]).digest("base64")}'`);
        const app = express();
        app.use(contentSecurityPolicy);
        app.get("/", (_req, res) => res.json({ nonce: res.locals.cspNonce }));
        const first = await supertest(app).get("/").expect(200);
        const second = await supertest(app).get("/").expect(200);
        expect(first.body.nonce).not.toBe(second.body.nonce);
        const header = first.headers["content-security-policy"];
        expect(header).toContain(`'nonce-${first.body.nonce}'`);
        expect(header).toContain(APP_BOOT_SCRIPT_HASH);
        expect(header).toContain("object-src 'none'");
        expect(header).toContain("script-src-attr 'none'");
        expect(header.split(";").find((part: string) => part.startsWith("script-src "))).not.toContain("'unsafe-inline'");
        expect(header).not.toContain("upgrade-insecure-requests");
    });
});
