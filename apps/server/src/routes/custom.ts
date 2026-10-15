import { cls, type Request as CoreRequest, routes } from "@triliumnext/core";
import type { Request, Response, Router } from "express";

import { bindEmitter } from "../cls_provider.js";
import { isScriptingEnabled } from "../services/scripting_guard.js";
import auth from "../services/auth.js";
import etapiTokens from "../services/etapi_tokens.js";
import { doubleCsrfProtection } from "./csrf_protection.js";

function register(router: Router) {
    // Public grants and ETAPI tokens support external integrations; cookie writes require CSRF.

    router.all("/custom/*path", (req: Request, res: Response, _next) => {
        bindEmitter(req);
        bindEmitter(res);

        cls.init(() => routes.handleCustomRequest(
            joinWildcardPath(req), req as unknown as CoreRequest, res, isScriptingEnabled,
            (note) => {
                // Publication is a separate, non-inherited grant on the matched note.
                const publicGrant = note.getOwnedLabel("customPublic");
                if ((publicGrant && publicGrant.value !== "false")
                    || etapiTokens.isValidAuthHeader(req.headers.authorization)) return true;

                let allowed = false;
                auth.checkApiAuth(req, res, () => {
                    doubleCsrfProtection(req, res, (error) => {
                        if (error) res.status(403).send("Invalid CSRF token");
                        else allowed = true;
                    });
                });
                return allowed;
            }
        ));
    });
}

/**
 * Rebuilds the path below `/custom/` from the `*path` wildcard.
 *
 * Express 5 splits a wildcard into one array entry per segment, where Express 4 passed the whole
 * remainder as a string. The segments arrive decoded, so joining them naively reproduces the
 * Express 4 behaviour a handler's pattern was written against.
 *
 * @TriliumNextTODO: remove the typecast once express types are fixed — they currently only treat
 * `req.params` as string, while in reality it can also be a string[] when using wildcards.
 * @TriliumNextTODO: `splitPath.map(segment => encodeURIComponent(segment)).join("/")` might be safer.
 */
function joinWildcardPath(req: Request): string {
    const splitPath = req.params.path as unknown as string[];

    return splitPath.join("/");
}

export default {
    register
};
