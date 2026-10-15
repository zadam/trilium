import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import helmet from "helmet";

// Only the fixed Electron compatibility shim in client/index.html; never hash note HTML.
export const APP_BOOT_SCRIPT_HASH = "'sha256-S+CDZx1tAK1sJ36jecFUYg5LNB5AJAs8esQekkpYH7I='";

/** A nonce covers the share theme's trusted boot script; owner script notes still need eval. */
export const contentSecurityPolicy: RequestHandler = (req, res, next) => {
    const nonce = randomBytes(32).toString("base64");
    res.locals.cspNonce = nonce;
    helmet.contentSecurityPolicy({
        useDefaults: false,
        directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            // Browser scripting, render notes, workers and WASM are supported product features.
            scriptSrc: ["'self'", "blob:", "'unsafe-eval'", `'nonce-${nonce}'`, APP_BOOT_SCRIPT_HASH],
            scriptSrcAttr: ["'none'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
            imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
            fontSrc: ["'self'", "data:", "blob:", "https:", "http:"],
            connectSrc: ["'self'", "https:", "http:", "ws:", "wss:"],
            mediaSrc: ["'self'", "data:", "blob:", "https:", "http:"],
            frameSrc: ["'self'", "data:", "blob:", "https:", "http:"],
            workerSrc: ["'self'", "blob:"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"]
        }
    })(req, res, next);
};
