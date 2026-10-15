import { getLog, isSetupAuthRequired, password } from "@triliumnext/core";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import config from "./config.js";
import { isInternalElectronRequest } from "./electron_request.js";
import sqlInit from "./sql_init.js";

const TOKEN_LIFETIME_MS = 60 * 60 * 1000;
let issued: { token: string; expires: number } | undefined;

/** A fresh server belongs to the operator with access to its startup console. */
export function isFirstRunTokenRequired(req: Request): boolean {
    return !isInternalElectronRequest(req) && !config.General.noAuthentication
        && (!sqlInit.schemaExists() || !password.isPasswordSet()
            || (!sqlInit.isDbInitialized() && !isSetupAuthRequired()));
}

/** Prints once per lifetime, never in an HTTP response or URL. Restarting also renews it. */
export function initializeFirstRunAuth(): void {
    if (issued && issued.expires > Date.now()) return;
    issued = { token: randomBytes(32).toString("hex"), expires: Date.now() + TOKEN_LIFETIME_MS };
    getLog().info(`First-run setup token (valid for one hour): ${issued.token}`);
}

export function checkFirstRunAuth(req: Request, res: Response, next: NextFunction): void {
    if (!isFirstRunTokenRequired(req)) {
        next();
        return;
    }
    initializeFirstRunAuth();
    if (isFirstRunAuthorized(req)) {
        next();
        return;
    }
    res.status(401).send("Enter the first-run setup token from the server log.");
}

/** Also used by API auth while the database cannot yet persist a browser session. */
export function isFirstRunAuthorized(req: Request): boolean {
    const token = req.headers["trilium-setup-auth"] ?? req.body?.setupToken;
    return typeof token === "string" && !!issued && issued.expires > Date.now()
        && Buffer.byteLength(token) === Buffer.byteLength(issued.token)
        && timingSafeEqual(Buffer.from(token), Buffer.from(issued.token));
}
