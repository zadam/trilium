> Remediation status (2026-10-14): the original audit below is preserved as historical evidence. See the remediation checkpoint and closure addendum at the end for the current patch and verification status.

# Security audit — Trilium

Date: 2026-10-14
Skill: `audit-security` v3.0 (read-only)
Report standard: agent-skills audit base v3.1–v3.3 (finding format, evidence discipline, severity matrix, confidence calibration)

```text
Target:      /Users/eric/Work/vscode/Trilium (branch main, clean at start, HEAD bad01ff7e6)
Involvement: L2 standard — inferred. The request names the output file, the skill standard, and a command exclusion.
Ceiling:     read_only — skill default. This file is the requested report. No product code was changed.
Assumed:     whole repository; no project overlay matches Trilium; LLM/MCP tool abuse is escalated, not audited as its own lens
Validation:  source quotes only. git status --short was clean before this file. No playtest. No exploit drill.
Execution:   one lens, sequential deep reads of auth, routes, share, clipper, sync, session, and deployment defaults
Restart:     this file is the checkpoint
```

Independent critic gate (`skill.yaml` `critic_required: true`): unmet. This session is one reviewer. A self-check is not an independent review. Catalog session-log and Dory checkpoint files were not written; the operator named this report as the only artifact, and this repository has no Dory store.

## Executive Verdict

Trilium's normal API is behind a session, a CSRF token, and (when enabled) TOTP. Three confirmed gaps sit beside that gate.

A password alone, with TOTP turned on, can still read `documentSecret` and then obtain a normal logged-in session. That defeats TOTP. On the desktop build, the web clipper has no credential of its own; turning on network access (the documented way to sync from another device) publishes that write API on the LAN. A fresh server binds `0.0.0.0` and accepts the first `POST /set-password` with no setup token.

Do not treat a TOTP-enabled server as second-factor protected until `SEC-TRI-001` is fixed. Do not enable desktop network access on an untrusted LAN until `SEC-TRI-002` is fixed. A fresh container whose port is reachable from outside the operator's machine can be claimed by whoever hits it first (`SEC-TRI-003`).

Findings are source-confirmed. Nothing was executed against a running instance. Patching is recommended for the three items above before those configurations are treated as safe. This audit does not say the whole tree is free of further issues; the validation limits say what was not read.

## Scope

- Repository: `/Users/eric/Work/vscode/Trilium`
- Branch / commit: `main` @ `bad01ff7e6` (`Text editor: table improvements (#12077)`)
- Change set: none. Full-tree audit of the security lens, not a diff review.
- Lens: `audit-security` only. Catalog search was a focused audit (`exhaustive_audit: false`). LLM trust-boundary work is recorded as an escalation, not performed.
- Prompt restrictions: report and analysis only; do not run playtest; follow agent-skill standards; write this file.
- Effort budget: one lens, priority on authentication, authorization, object scope, injection sinks, secrets, and deployment defaults. About 35 source files were read. Share, ETAPI, OpenID, import/zip, Electron preload, and the web-clipper extension were sampled or marked not reviewed.
- Commands run: `git rev-parse`, `git status --short`, `git log -1`. No test suite, no server, no playtest, no exploit request.
- Oracle integrity: no green test suite was used as evidence. Non-findings cite the guard in source.

## Draft Prompt Assessment

The mission is a defensive security audit and a written analysis. Explicit constraints were the output path, the agent-skill report contract, and "do not run playtest." Those were kept. The break-it checklist was applied as a static trace. Live requests against a running app would have been an unauthorized drill on top of the operator's exclusion.

Assumptions that were challenged: "the internal API trusts the frontend, so there is nothing to find" (the exceptions are the findings); "TOTP wraps every credential check" (it does not); "desktop loopback is a credential" (the MCP route's own comments reject that, and the clipper still relies on it).

Adjacent work proposed and not done: `audit-security-llm` for note-script and MCP tool agency; `audit-security-nodejs` for the SECN taxonomy (prototype pollution, ReDoS, upload bounds); `audit-dataflow-input-output` for import/zip and export; a same-site CSRF drill.

## Surface Inventory

| Surface | Actor | Input/Trigger | State/Output | Boundary | Reviewed |
|---|---|---|---|---|---|
| `POST /login`, `POST /api/login/token` | Anonymous, then owner | Password and optional TOTP | Session or ETAPI token | Rate limit + `verifyLoginCredentials` | Reviewed |
| `POST /set-password` | Anonymous, before a password exists | Two password fields | Password hash | `checkPasswordNotSet` only | Reviewed |
| `GET /api/setup/sync-seed` | Anyone with the password header | `trilium-cred` | `documentId` and `documentSecret` | `checkCredentials` (password only) | Reviewed |
| `POST /api/login/sync` | Sync peer | HMAC of `documentSecret` | `session.loggedIn = true` | HMAC + 5-minute skew | Reviewed |
| `PUT /api/sync/update` and sibling sync writes | Logged-in session | Entity rows | Database replace | `checkApiAuth`, no CSRF middleware | Reviewed |
| `GET /api/sync/stats` | Anonymous | HTTP GET | Init flag, pull counts, pre-init error | None | Reviewed |
| `/api/clipper/*` | Extension, or anyone who can reach it | Note HTML, files, labels | Notes, labels, UI `openNote` | ETAPI token on server; empty middleware on Electron | Reviewed |
| Desktop TCP listener | LAN or loopback | Host header, `allowLanAccess` | Web app, share, clipper, ETAPI | `desktopNetworkAccessGate` + bind address | Reviewed |
| `/custom/*` | Anyone who can reach the port | Path | Note bytes or a backend script | Label match only; scripts need `backendScriptingEnabled` | Reviewed |
| `/share/*` | Anonymous or HTTP Basic | Note id, search | Shared subtree | Shaca subtree, `shareCredentials`, protected-note refusal | Sampled |
| `/mcp` | Bearer token | MCP JSON | Tool execution | ETAPI token, disabled unless the option is on | Sampled (auth gate only) |
| `/etapi/*` | Bearer token | REST | Notes and files | `checkEtapiAuth`, unless `noAuthentication` | Sampled (auth wrapper only) |
| Session cookie | Browser | Cookie | Session row in SQLite | `httpOnly`, `sameSite: lax`, `secure` follows `Network.https` | Reviewed |
| Image download | Note save / clipper | `<img src>` | Attachment bytes | `http:`/`https:` only | Reviewed |
| Backend scripts, SQL console | Owner, or `/custom` handler | Note code | Process | Default off | Sampled (defaults only) |
| OpenID, Electron preload, web-clipper extension, import zip, LLM tool execute | — | — | — | — | Not reviewed |

## Boundary Map

| Surface | Intended Boundary | Enforced At | Status |
|---|---|---|---|
| Ordinary `/api/*` via `apiRoute` / `asyncApiRoute` | Session and CSRF | `route_api.ts` `apiRoute` adds `checkApiAuth` and `doubleCsrfProtection` | Holds |
| Page shell before login | SPA may load; API may not | `checkAuth` falls through; `checkApiAuth` requires `session.loggedIn` | Holds |
| Electron renderer | In-process custom protocol, not TCP | Symbol `trilium-electron-internal-request`, not a header | Holds |
| TOTP | Second factor on every password login | `verifyLoginCredentials` | Fails on `checkCredentials` and `loginSync` (`SEC-TRI-001`) |
| Desktop clipper | Same token as the server clipper, or loopback is not authority | `clipperMiddleware` is `[]` when `isElectron` | Fails when `allowLanAccess` (`SEC-TRI-002`) |
| First password | Only the operator who installed the process | None. Bind default `0.0.0.0` | Fails on a reachable port (`SEC-TRI-003`) |
| Sync writes | Same CSRF bar as other mutations | Middleware list is `checkApiAuth` only | Missing (`SEC-TRI-004`) |
| `/custom` | Public only when the owner meant to publish | No auth middleware | Open whenever a matching label exists (`SEC-TRI-005`) |
| Remote images | Do not fetch link-local or loopback by default | Protocol allow-list only | Missing (`SEC-TRI-006`) |
| Share credentials | HTTP Basic, constant-time compare, protected notes never streamed | `hasCredentialAccess`, `rejectProtected` | Holds on the paths read |
| MCP | ETAPI token even from loopback | `resolveMcpAccess` | Holds |
| `noAuthentication` | Operator opt-in, default false | `config.General.noAuthentication` default `false` | Holds as a default; it disables auth globally when set |
| Reverse proxy | Do not trust `X-Forwarded-For` unless configured | `trustedReverseProxy` default false | Holds |
| Backend scripting | Off unless opted in | `Security.backendScriptingEnabled` default `false` | Holds |

## Findings Table

| ID | Severity | Confidence | Evidence Basis | Domain | Title | Patch Priority | Blast Radius | Complexity | Cost | Nominal Agent |
|---|---|---|---|---|---|---|---|---|---|---|
| SEC-TRI-001 | High | Confirmed | source-evidenced | Security | Password alone bypasses TOTP and mints a full session | 1 | Service | local_guardrail | S | grok |
| SEC-TRI-002 | High | Confirmed | source-evidenced | Security | Desktop clipper has no credential; LAN opt-in exposes it | 2 | Service | local_guardrail | S | grok |
| SEC-TRI-003 | High | Confirmed | source-evidenced | Security | First `POST /set-password` claims a world-bound fresh server | 3 | Service | workflow_protocol | M | human-owner |
| SEC-TRI-004 | Medium | Confirmed | source-evidenced | Security | State-changing sync routes skip CSRF | 4 | Service | local_guardrail | S | grok |
| SEC-TRI-005 | Medium | Confirmed | source-evidenced | Security | `/custom` serves note bytes with no authentication | 5 | Service | governance_decision | M | human-owner |
| SEC-TRI-006 | Medium | Confirmed | source-evidenced | Security | Automatic image download allows any http(s) URL, including link-local | 6 | Service | local_guardrail | S | grok |
| SEC-TRI-007 | Low | Confirmed | source-evidenced | Security | Anonymous sync stats | 7 | Local | local_guardrail | XS | grok |
| SEC-TRI-008 | Info | Confirmed | source-evidenced | Security | Helmet content security policy is disabled | 8 | Service | governance_decision | M | human-owner |

Severity for `SEC-TRI-002` and `SEC-TRI-003` is the reachable deployment, not the safest default. The posture split is in each finding. Runtime exploitation was not observed; the missing guards are deterministic in source (`confidence_calibration.md`: a schema or middleware omission may be Confirmed).

## Detailed Findings

### SEC-TRI-001: Password alone bypasses TOTP and mints a full session

Severity: High
Confidence: Confirmed
Evidence basis: source-evidenced
Domain: Security

Evidence:
- `packages/trilium-core/src/routes/index.ts:196` — `route(GET, "/api/setup/sync-seed", [loginRateLimiter, checkCredentials], setupApiRoute.getSyncSeed, apiResultHandler);`
- `apps/server/src/services/auth.ts:259-275` — `checkCredentials` decodes `trilium-cred` and calls `verifyPassword`. It never calls `totp`.
- `packages/trilium-core/src/services/setup.ts:123-125` — `getSyncSeedOptions` returns `documentId` and `documentSecret`.
- `packages/trilium-core/src/becca/entities/boption.ts:46-52` — `getPojo` includes `value`.
- `apps/server/src/routes/api/login.ts:103-123` — on a matching HMAC, `loginSync` sets `req.session.loggedIn = true` and does not consult TOTP.
- `apps/server/src/routes/routes.ts:124` — `POST /api/login/sync` is mounted with `loginRateLimiter` only.
- Contrast that does hold: `apps/server/src/services/auth.ts:290-299` — `verifyLoginCredentials` checks the password and then TOTP or a recovery code. `POST /login` and `POST /api/login/token` use that function.

Observed behavior:
- With TOTP enabled, `POST /login` refuses a correct password that lacks a valid second factor.
- `GET /api/setup/sync-seed` is registered on a live instance (no `checkAppNotInitialized`). The only credential check is the password header.
- The handler returns the document secret. `POST /api/login/sync` accepts an HMAC of that secret and a timestamp within five minutes, regenerates the session, and sets `loggedIn`. `checkApiAuth` treats that flag as a full owner session. Bootstrap then issues a CSRF token to that session (`apps/server/src/routes/index.ts:147-150`).

Expected boundary:
- A second factor that is required at the password login is required on every route that accepts the same password and on every route that upgrades that proof into a browser session.

Failure mechanism:
- Sync login was built for a peer that already holds `documentSecret`. `getSyncSeed` is how a peer learns that secret, and it was wired to the password check rather than to `verifyLoginCredentials`. `loginSync` then upgrades the secret into the same session flag the password form sets. TOTP is only in the form and the token route.

Break-it angle:
- Enable TOTP. Call `GET /api/setup/sync-seed` with `trilium-cred` set to the password and no TOTP code. Read `documentSecret` from the option pojo. Compute the HMAC the route already documents and `POST /api/login/sync`. The response session passes `checkApiAuth`. `GET /api/login/token` with the same password and no TOTP still returns 401, which shows the second factor exists and this pair of routes skips it.

Impact:
- Password disclosure (phish, reuse, a backup of the password) is sufficient to read and modify every note. The TOTP secret never has to be stolen. A sync peer that already has `documentSecret` can already pull the database; the new fact is that the password alone reaches that secret.

Operational impact:
- Blast radius: Service
- Side-effect class: DB
- Reversibility: compensatable
- Operator visibility: log-only
- Rerun safety: safe

Adjacent failure modes:
- `SEC-TRI-004`: that session can call sync writes that are not CSRF-checked.
- Sync `replace` interpolates `entityName` and column names (`SEC-006` non-finding). A session obtained this way is already the owner, so that is not a further privilege jump.

Recommended mitigation:
- Remediation patterns: same-factor login; split sync authority from the browser session.
- Minimal repair: `checkCredentials` and `getSyncSeed` must go through `verifyLoginCredentials` (password, then TOTP or recovery code) whenever TOTP is enabled. Return 401 on failure so the existing login rate limiter counts the attempt.
- Local guardrail: a sync session flag that `checkApiAuth` accepts only for `/api/sync/*`, so a document-secret proof cannot call note, option, or backup routes.
- Behavior test: with TOTP enabled, password-only `GET /api/setup/sync-seed` is 401 and does not contain `documentSecret`. Password-only `POST /api/login/sync` does not leave `session.loggedIn` able to `GET` an authenticated note route.

Implementation assessment:
- Complexity: local_guardrail
- Cost: S
- Cost drivers: modules, tests
- Nominal implementation agent: grok
- Rationale: the repair is two call sites and a regression spec. The product choice of whether a sync peer should keep a full browser session is a one-line policy inside that same change, not a new subsystem.

Validation:
- Spec: TOTP on, wrong or missing code, sync-seed response status is 401 and the body has no `documentSecret`.
- Spec: TOTP on, valid password and valid code, sync-seed still returns the secret (the legitimate pair flow keeps working).
- Spec: a session created by `loginSync` receives 401 from a non-sync `apiRoute` if the sync-scoped flag is adopted.

Non-goals:
- Do not remove sync, and do not require TOTP on an instance where TOTP is off.
- Do not rotate `documentSecret` in this change.

Calibration: static property confirmed (the middleware list and the absent TOTP call). Runtime manifestation not observed in this run. Confidence ceiling not lowered: both branches are direct and do not depend on timing, workers, or a proxy.

### SEC-TRI-002: Desktop clipper has no credential; LAN opt-in exposes it

Severity: High
Confidence: Confirmed
Evidence basis: source-evidenced
Domain: Security

Evidence:
- `apps/server/src/routes/routes.ts:132-140` — `const clipperMiddleware = isElectron ? [] : [auth.checkEtapiToken];` and that array is the only middleware on handshake, clippings, notes, files, open, and notes-by-url.
- `apps/server/src/services/host.ts:4-12` — desktop binds `127.0.0.1` unless `allowLanAccess`, in which case it binds `0.0.0.0`.
- `apps/server/src/services/desktop_network_gate.ts:65-76` — `allowLanAccess` returns "do not block" before the loopback Host check. The Host check exists only while network access is off, and only for `/mcp`, `/api/clipper`, and `/etapi`.
- `apps/server/src/services/config.ts:564-570` — `allowLanAccess` defaults to false.
- `apps/server/src/routes/mcp.ts:75-84` — the MCP guard states the project's own rule: loopback is not a credential, because any local process can reach it.
- `apps/server/src/routes/api/clipper.ts:225-228` — `setLabels` writes each caller-supplied label name. `BAttribute.beforeSaving` sanitizes the character set and still allows `shareRaw`, `shareRoot`, and `customResourceProvider`.
- `apps/server/src/routes/api/clipper.ts:341-346` — `openNote` pushes `openNote` to every connected client.

Observed behavior:
- On the server build the clipper requires an ETAPI token.
- On the desktop build the same routes have an empty middleware list. With network access off, the gate still requires a loopback Host header, so a DNS-rebound browser is refused and a local process that sends `Host: 127.0.0.1` is accepted.
- With network access on, the gate does not run and the listener is on all interfaces. Those routes create notes, upload files, set labels, look up clippings by URL, and tell the UI to open a note. There is no ETAPI token and no session.

Posture:

| Posture | Severity |
|---|---|
| Desktop, `allowLanAccess` false (default) | Medium. A local process can write notes. A remote host cannot. |
| Desktop, `allowLanAccess` true | High. Any host that can open the port can write notes. |
| Server build | Not this bug. Clipper uses `checkEtapiToken`. |

Expected boundary:
- The clipper write API requires a credential the browser extension holds, on every build. Enabling "reach this desktop from another device" may expose the login page and the authenticated sync port. It must not expose an unauthenticated writer. The MCP comment already states that loopback is not that credential.

Failure mechanism:
- Electron skipped the token so the extension could talk to a local app without an ETAPI token. The LAN opt-in was added later for sync and turns off the only remaining check (`Host` is loopback) for every path, including the clipper.

Break-it angle:
- Turn on network access. From another machine on the LAN, `POST /api/clipper/notes` with a title and a `labels` object. The handler creates a note under the clipper inbox or the root. `POST /api/clipper/open/:noteId` makes the desktop navigate. `GET /api/clipper/notes-by-url/:noteUrl` reports whether a previous clip exists.

Impact:
- Unauthenticated note creation, file upload, label writes (including labels that publish through `/custom` and share), and forced navigation in the desktop UI. Combined with `SEC-TRI-005` and `SEC-TRI-006`, a LAN client can also publish a note it just wrote and cause the desktop to fetch an http(s) URL.

Operational impact:
- Blast radius: Service
- Side-effect class: DB
- Reversibility: compensatable
- Operator visibility: log-only
- Rerun safety: unsafe

Adjacent failure modes:
- `SEC-TRI-005`, `SEC-TRI-006`, `SEC-013` (the dangerous-attribute warning is client UI; `setLabel` does not consult `isDangerous`).

Recommended mitigation:
- Remediation patterns: bearer token on the integration; do not treat the bind address as authentication.
- Minimal repair: use `auth.checkEtapiToken` on the desktop clipper as well. The extension already has a token path on the server build.
- Local guardrail: keep the loopback Host check in force for `/api/clipper` even when `allowLanAccess` is true, until the token requirement has shipped.
- Behavior test: with `isElectron` and `allowLanAccess` true, `POST /api/clipper/notes` without `Authorization` returns 401 and creates no note. The same call with a valid ETAPI token returns a note id.

Implementation assessment:
- Complexity: local_guardrail
- Cost: S
- Cost drivers: modules, tests, docs
- Nominal implementation agent: grok
- Rationale: one middleware array and a desktop-gate regression. The extension's token setup is existing product behavior on the server, so this is not a new auth design. Docs must say the desktop extension needs a token.

Validation:
- Assert the HTTP status and that the notes table did not grow. Do not assert on the source text of the middleware array.
- Assert a request with `Host` set to an attacker name is still 403 when `allowLanAccess` is false.

Non-goals:
- Do not require a token for the in-process `trilium-app://` renderer. That path is the symbol in `electron_request.ts`, and it is not the clipper.
- Do not redesign MCP. It already requires a token.

Calibration: static property confirmed. LAN reachability follows from `listen(port, "0.0.0.0")` plus an empty middleware list. Not executed.

### SEC-TRI-003: First `POST /set-password` claims a world-bound fresh server

Severity: High
Confidence: Confirmed
Evidence basis: source-evidenced
Domain: Security

Evidence:
- `apps/server/src/services/config.ts:360-365` — `Network.host` default `0.0.0.0`.
- `apps/server/src/services/config.ts:372-376` — `Network.https` default `false`.
- `docker-compose.yml:10-16` — host port `8080` is published and the comment says the service is reachable at `http://<host-ip>:8080`.
- `apps/server/src/routes/routes.ts:55` — `POST /set-password` middleware is `checkAppInitialized` and `checkPasswordNotSet` only. No session, no CSRF middleware, no rate limiter.
- `apps/server/src/routes/login.ts:27-46` — the first caller whose two passwords match and whose password is at least 4 characters becomes the password. There is no setup token.
- `apps/server/src/services/auth.ts:166-171` — `checkApiAuth` still requires `session.loggedIn` in this window, so the rest of the API is not anonymously writable before a password exists.
- `apps/server/src/routes/session_parser.ts:125-130` — the session cookie is `secure` only when `Network.https` is true, and `sameSite` is `lax`.

Observed behavior:
- Until a password is stored, whoever can open the port can set it. The legitimate operator then finds the password already set. The database at that moment has no owner-created notes, because the API still demands a session the operator cannot obtain without the password.
- After a password exists, the session cookie is sent on cleartext HTTP whenever `https` stays at the default.

Posture:

| Posture | Severity |
|---|---|
| Port reachable from a network the operator does not control (published Docker port, VPS, default bind) | High |
| Port bound to loopback only | Low. The operator is the only caller. |

Expected boundary:
- The process that created the data directory is the only caller allowed to set the first password. A shared secret printed once at startup, or a default bind of loopback until that password exists, enforces that. A firewall comment in `docker-compose.yml` does not.

Failure mechanism:
- Setup auth (`checkSetupAuth`) protects a wizard that is standing over an existing database. The first-run password route was left as an open claim. The default listen address makes the claim network-reachable.

Break-it angle:
- Start the compose file on a host with a public or LAN address. Before the operator opens the UI, `POST /set-password` with two matching strings of length 4. The operator's later attempt is rejected with "Password has been already set."

Impact:
- Loss of the new instance to the first caller. No existing note body is read, because none can be written yet. After takeover, that caller is the owner of whatever is created next. Cleartext session cookies on the default HTTP bind are the ongoing exposure once a real password is in use.

Operational impact:
- Blast radius: Service
- Side-effect class: DB
- Reversibility: compensatable
- Operator visibility: UI-visible
- Rerun safety: unsafe

Adjacent failure modes:
- `SEC-TRI-008` is unrelated. Session cookie `secure: false` by default is this finding's follow-on, not a second root cause.
- Minimum length 4 is a weak policy on the same route. It is not a separate defect.

Recommended mitigation:
- Remediation patterns: setup token; fail closed on the bind until initialized.
- Minimal repair: at startup, if no password is set, generate a short-lived setup token, log it once, and require it on `POST /set-password`. Reject the body without it.
- Local guardrail: when no password is set, bind `127.0.0.1` unless an explicit `TRILIUM_NETWORK_HOST` is present. Document that publishing the port before the token is used hands the instance away.
- Behavior test: with no password stored, `POST /set-password` without the token is 401 and `isPasswordSet()` stays false. The same body with the token sets it.

Implementation assessment:
- Complexity: workflow_protocol
- Cost: M
- Cost drivers: modules, tests, docs, operator_training
- Nominal implementation agent: human-owner
- Rationale: the token check is small, and the default bind change affects every Docker and reverse-proxy install. That default is an operator decision. The report recommends the token either way, and recommends loopback-until-initialized as the safe default.

Validation:
- Integration test on a fresh data directory: unauthenticated set-password does not persist; token set-password does; a second call is rejected.
- Assert the listen address only if the bind default is changed. Do not claim a firewall from the compose comment.

Non-goals:
- Do not add TOTP to first-run. There is no second factor yet.
- Do not block `POST /set-password` on Electron. The trusted renderer is a different path (`checkPasswordNotSet` already redirects when a password exists).

Calibration: static property confirmed. No container was started.

### SEC-TRI-004: State-changing sync routes skip CSRF

Severity: Medium
Confidence: Confirmed
Evidence basis: source-evidenced
Domain: Security

Evidence:
- `packages/trilium-core/src/routes/index.ts:231-234` — `PUT /api/sync/update`, `POST /api/sync/finished`, `POST /api/sync/check-entity-changes`, and `POST /api/sync/queue-sector/:entityName/:sector` use `[checkApiAuth]` only.
- `apps/server/src/routes/route_api.ts:69-70` — `apiRoute` always adds `csrfMiddleware`. These sync routes call `route()` directly and therefore do not.
- `apps/server/src/routes/session_parser.ts:129` — `sameSite: "lax"`.
- `packages/trilium-core/src/routes/api/sync.ts:354-357` — `update` passes `entities` to `syncUpdateService.updateEntities`.

Observed behavior:
- A logged-in browser will attach `trilium.sid` to a same-site POST or PUT. Cross-site POST does not send a Lax cookie. The sync write routes do not check `x-csrf-token`. Other mutations do.

Expected boundary:
- Every state-changing route that trusts the session cookie also requires the CSRF token, including sync push.

Failure mechanism:
- Sync clients are not browsers, so the CSRF middleware was left off. The session they use is the same browser session `SEC-TRI-001` and the login form create. Same-site pages (another host under the same registrable domain) can therefore submit a sync push with the victim's cookie.

Break-it angle:
- From a sibling origin, with the victim logged in, send `PUT /api/sync/update` with `pageCount: 1`, `pageIndex: 0`, and an `entities` array. No `x-csrf-token`. Cross-site (a different site) is expected to fail because of `SameSite=Lax` and was not executed.

Impact:
- Same-site request forgery can push entity rows into the document: notes, attributes, and whatever `replace` accepts for that session. Cross-site forgery of this route is not claimed.

Operational impact:
- Blast radius: Service
- Side-effect class: DB
- Reversibility: compensatable
- Operator visibility: log-only
- Rerun safety: unsafe

Adjacent failure modes:
- `SEC-TRI-001` widens who can hold the session.
- Partial sync bodies accumulate in the module-level `partialRequests` map (`sync.ts:259-265`, `331-352`) keyed by a caller-chosen `requestId`. That is an authenticated memory sink, not demonstrated under load, so it stays a note rather than a separate finding.

Recommended mitigation:
- Remediation patterns: CSRF on cookie-authenticated mutations; or a header that browsers will not send cross-site (`Authorization`) for sync.
- Minimal repair: add `csrfMiddleware` to the four state-changing sync registrations. Sync clients that already have the session can read the CSRF token the way the web app does, or send a dedicated sync header that `doubleCsrfProtection` is taught to accept.
- Behavior test: cookie session, no `x-csrf-token`, `PUT /api/sync/update` returns 403 and the note count is unchanged. The same call with the token applies.

Implementation assessment:
- Complexity: local_guardrail
- Cost: S
- Cost drivers: modules, tests
- Nominal implementation agent: grok
- Rationale: middleware is already the pattern. The only design point is how the non-browser sync client presents the token, and the server already has a header slot for that.

Validation:
- Assert 403 versus an applied entity change. Include a same-site cookie fixture if the harness can set `SameSite`.

Non-goals:
- Do not switch the session cookie to `SameSite=Strict` in this slice. That is a separate compatibility choice.
- Do not add CSRF to `GET /api/sync/changed`.

Calibration: the missing middleware is confirmed. Same-site cookie behavior is the documented `SameSite=Lax` rule, not a measurement from this run. Cross-site success is not claimed.

### SEC-TRI-005: `/custom` serves note bytes with no authentication

Severity: Medium
Confidence: Confirmed
Evidence basis: source-evidenced
Domain: Security

Evidence:
- `apps/server/src/app.ts:132` — `custom.register(app)` is on the application, not behind `checkApiAuth`.
- `apps/server/src/routes/custom.ts:7-16` — `router.all("/custom/*path", ...)` has no auth middleware. The comment says CSRF is omitted so external services can call it. Authentication is omitted too.
- `packages/trilium-core/src/routes/custom.ts:50-54` — a matching `customResourceProvider` calls `downloadNoteInt`. A matching `customRequestHandler` runs `scriptService.executeNote` only when `isScriptingEnabled()` is true.
- `apps/server/src/services/config.ts:551-555` — `backendScriptingEnabled` defaults to false, and the handler then returns 403.
- `packages/commons/src/lib/builtin_attributes.ts:105-106` — both labels are `isDangerous: true`. That flag is a client catalogue field. The server attribute save path sanitizes the name and does not refuse the label.

Observed behavior:
- Any note carrying `customResourceProvider` is readable at `/custom/<pattern>` by any client that can open the port, on the server build. On the desktop build the network gate blocks `/custom` until `allowLanAccess` is on, and then it does not.
- A `customRequestHandler` does not run while backend scripting is off.

Expected boundary:
- Publishing a note or binding a URL to a script is an explicit server-side grant, not a consequence of a label that any API writer can set. The dangerous-attribute UI warning is not that grant.

Failure mechanism:
- `/custom` was left unauthenticated so external callers would not need a session. The label that selects the note is an ordinary attribute. Nothing on the server checks that the owner confirmed the publish.

Break-it angle:
- As the owner, or as the clipper in `SEC-TRI-002`, set `customResourceProvider` to a pattern and request `/custom/` plus that path with no cookie. The response is the note body. With scripting left at the default, a `customRequestHandler` note returns 403 rather than executing.

Impact:
- Note contents that carry the resource-provider label are public on a reachable server. A handler label becomes unauthenticated code execution only after the operator turns backend scripting on. That second half is an opt-in the startup log already warns about (`apps/server/src/www.ts:120-125`).

Operational impact:
- Blast radius: Service
- Side-effect class: user-visible
- Reversibility: reversible
- Operator visibility: silent
- Rerun safety: safe

Adjacent failure modes:
- `SEC-TRI-002` can set the label without the UI warning.
- `shareRaw` is a similar opt-in publish path. It was not re-audited beyond the share handler's protected-note refusal.

Recommended mitigation:
- Remediation patterns: authenticated publish list; default deny.
- Minimal repair: require a session or an ETAPI token for `/custom` unless the note also carries an explicit `customPublic` label that the server, not only the UI, treats as the publish bit.
- Local guardrail: while that label does not exist, keep serving resource providers and document them as public. Do not leave the danger flag only in the client catalogue.
- Behavior test: a note with `customResourceProvider` and no public grant returns 401 with no cookie. A granted note still returns its body with no cookie.

Implementation assessment:
- Complexity: governance_decision
- Cost: M
- Cost drivers: modules, tests, docs
- Nominal implementation agent: human-owner
- Rationale: some installations use `/custom` as a public webhook on purpose. Changing the default from open to authenticated is a product decision. The report's repair is the one that matches the `isDangerous` flag; shipping it without a migration note would break those webhooks.

Validation:
- Status code and body absence, with and without the grant label.

Non-goals:
- Do not disable `/custom`.
- Do not turn on backend scripting.

Calibration: the missing middleware and the download call are confirmed. No request was sent.

### SEC-TRI-006: Automatic image download allows any http(s) URL, including link-local

Severity: Medium
Confidence: Confirmed
Evidence basis: source-evidenced
Domain: Security

Evidence:
- `packages/trilium-core/src/services/options_init.ts:224` — `downloadImagesAutomatically` default `"true"`.
- `packages/trilium-core/src/services/image_download.ts:122-135` — `downloadImage` rejects non-`http:` and non-`https:` URLs and then calls `request.getImage`. No host, address, or port check.
- `packages/trilium-core/src/services/image_download.ts:199-230` — `downloadImages` schedules that fetch for an `<img src>` that is not already an internal attachment URL.

Observed behavior:
- Saving note HTML, and the clipper's `processContent` path, will cause the server to request the image URL when the option is at its default. `file:` is rejected. `http://127.0.0.1/`, `http://169.254.169.254/`, and private-network addresses are not.

Expected boundary:
- A fetch started from note content does not reach loopback, link-local, or private addresses unless the operator turns that on. Redirects to those addresses are refused too.

Failure mechanism:
- The scheme check was added to stop `file:` and similar schemes. It was not followed by an address check, and the feature ships on.

Break-it angle:
- With the option left on, save a note whose HTML contains an image pointed at a loopback or link-local HTTP URL. The server issues that request and stores the bytes as an attachment. This was not executed. Who can trigger it is the owner, a sync peer, or the unauthenticated desktop clipper in `SEC-TRI-002`. The bytes are stored on the server; this review did not find a clipper response that returns them to the caller.

Impact:
- Server-side request forgery from note content. On a cloud VM the metadata address is the usual target. Exfiltration back to an outside page is not shown; the response is stored as an attachment of the note.

Operational impact:
- Blast radius: Service
- Side-effect class: network
- Reversibility: reversible
- Operator visibility: log-only
- Rerun safety: safe

Adjacent failure modes:
- `SEC-TRI-002` is an unauthenticated trigger on the desktop LAN build.
- Redirect following was not read in `request.getImage`. If redirects are followed, the severity stays and the block has to be applied to every hop. That part is unconfirmed.

Recommended mitigation:
- Remediation patterns: allow-list public addresses; deny loopback, link-local, and private ranges at connect time.
- Minimal repair: resolve the host and refuse non-public addresses before `getImage`. Re-check the connected address so a DNS rebind between check and connect does not slip through.
- Behavior test: a note save whose image URL is `http://127.0.0.1/` does not open a connection, and the option default can be turned off in a test without changing production's default until the block exists.

Implementation assessment:
- Complexity: local_guardrail
- Cost: S
- Cost drivers: modules, tests
- Nominal implementation agent: grok
- Rationale: one fetch policy and a unit test with a reserved address. No migration.

Validation:
- Assert no connection and no attachment row. A public test URL may still download when the option is on.

Non-goals:
- Do not turn the option off by default in the same patch unless the owner asks. The defect is the address policy.

Calibration: the absent address check is confirmed. No fetch was performed. Resource-exhaustion behavior of many parallel downloads is not claimed.

### SEC-TRI-007: Anonymous sync stats

Severity: Low
Confidence: Confirmed
Evidence basis: source-evidenced
Domain: Security

Evidence:
- `packages/trilium-core/src/routes/index.ts:235` — `route(GET, "/api/sync/stats", [], syncApiRoute.getStats, apiResultHandler);`
- `packages/trilium-core/src/routes/api/sync.ts:41-60` — when the schema exists, the body contains `initialized` and the pull counts. `lastSyncError` is added only when the instance is not initialized.

Observed behavior:
- Anyone who can open the port learns whether the document is initialized and how many pull rows are outstanding. Before initialization they also receive the last sync error string.

Expected boundary:
- Sync progress is visible to the setup wizard and to a logged-in session, not to an anonymous caller on a live instance.

Failure mechanism:
- The route was left open so the wizard can poll before a session exists. The same registration stays in place after `initialized` is true. The handler redacts the error string after init and still returns the counters.

Break-it angle:
- `GET /api/sync/stats` with no cookie against an initialized instance. Expect the three counters. Do not expect note contents; the handler does not read them.

Impact:
- Low. It confirms a Trilium listener and leaks sync progress. It does not grant a session.

Operational impact:
- Blast radius: Local
- Side-effect class: none
- Reversibility: reversible
- Operator visibility: silent
- Rerun safety: safe

Adjacent failure modes:
- `GET /api/health-check` (`apps/server/src/routes/routes.ts:122`) returns `{ status: "ok" }` with no auth. That is appropriate for a probe and is not a finding.
- `GET /api/setup/status` is also open and, while the schema exists, the database is not initialized, and setup auth is not required, includes `syncServerHost` and `syncProxy` (`setup.ts:47-52`). That window is the wizard's own prefill. It is withheld once auth is required or the instance is up. Not raised as a separate defect.

Recommended mitigation:
- Remediation patterns: split the pre-init poll from the live poll.
- Minimal repair: after `initialized` is true, require `checkApiAuth` for this route. Keep the open poll only while the wizard is the caller.
- Behavior test: initialized database, no session, `GET /api/sync/stats` is 401. Uninitialized database, the wizard still receives `lastSyncError`.

Implementation assessment:
- Complexity: local_guardrail
- Cost: XS
- Cost drivers: modules, tests
- Nominal implementation agent: grok
- Rationale: a branch on a flag the handler already computes.

Validation:
- Status and body keys, not a snapshot of the counters.

Non-goals:
- Do not hide the health check.

Calibration: confirmed from the handler. Not requested against a live port.

### SEC-TRI-008: Helmet content security policy is disabled

Severity: Info
Confidence: Confirmed
Evidence basis: source-evidenced
Domain: Security

Evidence:
- `apps/server/src/app.ts:84-92` — `helmet({ contentSecurityPolicy: false, ... })`.
- SVG responses set their own policy (`packages/trilium-core/src/services/utils/index.ts:213` and the share SVG reply). HTML share pages do not use that header.

Observed behavior:
- HTML responses, including the app and shared HTML, do not get a Content-Security-Policy from Helmet. SVG bytes that the share and image routes serve do get `default-src 'none'`.

Expected boundary:
- A CSP is a backstop for HTML the sanitizer failed to clean. It is not a substitute for the sanitizer.

Failure mechanism:
- The app shell needs inline scripts, and the global policy was turned off rather than written as an allow-list. Share HTML is sanitized (`content_renderer.ts` passes `sanitize.sanitizeHtml`). `shareRaw` is an owner opt-in that serves the note's own HTML without that sanitizer (`handlers.ts:160-181`), and it is marked dangerous.

Impact:
- If a sanitizer bypass appears later, the app origin has no CSP to contain it. This is hardening, not a demonstrated script injection.

Operational impact:
- Blast radius: Service
- Side-effect class: none
- Reversibility: reversible
- Operator visibility: silent
- Rerun safety: safe

Adjacent failure modes:
- A stored-XSS finding in the share sanitizer would escalate this from Info to High. No bypass was established in this pass.

Recommended mitigation:
- Remediation patterns: a real CSP for the app shell and for share HTML, with nonces for the scripts the shell needs.
- Minimal repair: none in this audit. Writing a policy that does not break the editor is a product change.
- Behavior test: when a policy exists, a shared page's response includes it and the editor still loads.

Implementation assessment:
- Complexity: governance_decision
- Cost: M
- Cost drivers: modules, tests, docs
- Nominal implementation agent: human-owner
- Rationale: a wrong CSP takes down the editor. The owner should decide the allow-list with a browser pass, which this audit was told not to playtest.

Validation:
- Response header on `/` and on a shared HTML note, plus an editor smoke test. Not run here.

Non-goals:
- Do not turn Helmet's default CSP on as a drive-by. It will block the app.

Calibration: the `false` flag is confirmed. No browser was opened.

## Inventory Result

| Item | Disposition |
|---|---|
| SEC-001 Missing authentication | Findings `SEC-TRI-002`, `SEC-TRI-003`, `SEC-TRI-005`, `SEC-TRI-007`. Ordinary `apiRoute`s require a session. |
| SEC-002 Missing authorization | Non-finding for the single-owner model after login. There is no second user to authorize. Share uses `hasCredentialAccess`. |
| SEC-003 Object scope / IDOR | Non-finding on share content routes that call `checkNoteAccess` / `checkNoteContentAccess`. Not applicable between users. Clipper URL lookup is an oracle and is part of `SEC-TRI-002`. |
| SEC-004 Privilege escalation | Finding `SEC-TRI-001`. |
| SEC-005 Trust boundary confusion | Electron marker cannot be set by a header (`electron_request.ts:16-25`). Clipper label writes skip the dangerous-attribute warning (`SEC-TRI-002`). LLM output as authority was not reviewed. |
| SEC-006 Injection | Finding `SEC-TRI-006`. SQL non-finding below. |
| SEC-007 Secret exposure | `SEC-TRI-001` returns `documentSecret` to a password-only caller. ETAPI tokens are stored as SHA-256 (`etapi_tokens.ts:11-22`). Compared with `constantTimeCompare` (`utils.ts:62-79`). Password values were not found in the login log lines that were read. |
| SEC-008 Unsafe path / file | Partial non-finding: clipper file names go through `path.basename` (`clipper.ts:157`). Import zip and `openFile` were not reviewed. |
| SEC-009 Unsafe deployment default | Finding `SEC-TRI-003`. `noAuthentication` defaults false (`config.ts:334-338`). |
| SEC-010 Sensitive route exposure | Findings `SEC-TRI-004`, `SEC-TRI-005`, `SEC-TRI-007`. |
| SEC-011 Overbroad permission | `SEC-TRI-002`. `noAuthentication` is an explicit opt-in, not a default. |
| SEC-012 Unsafe external invocation | `SEC-TRI-006`. Backend scripting defaults off. |
| SEC-013 Security boundary only in UI | Dangerous attribute flags are catalogue metadata. The server accepts the labels. Counted inside `SEC-TRI-002` and `SEC-TRI-005`. |
| SEC-014 Reverse proxy assumption | Non-finding. `trustedReverseProxy` defaults false and `www.ts:135-137` sets `trust proxy` only when it is configured. Login rate limiting then uses the socket address. |
| SEC-015 Provider / environment secret leakage | Not confirmed in the paths read. OAuth client secret is a config field. Logging of that value was not traced through OpenID. |

## Non-Findings / Checked But Not Confirmed

- Ordinary API authentication. `apiRoute` and `asyncApiRoute` attach `checkApiAuth` and `csrfMiddleware` (`route_api.ts:69-74`). A missing session gets 401 (`auth.ts:170-171`).
- Electron TCP versus the renderer. `isInternalElectronRequest` reads a symbol (`electron_request.ts:19-25`). A client header cannot set it. `checkApiAuth` documents that TCP to the desktop listener does not take the bypass (`auth.ts:160-167`).
- Login session fixation. `login` and `loginSync` call `session.regenerate` before `loggedIn = true` (`login.ts:96`, `routes/api/login.ts:113-121`).
- TOTP on the password form. `verifyLoginCredentials` checks the password first, then TOTP or a one-time recovery code (`auth.ts:284-299`). Recovery-code consumption is not reached when the password is wrong.
- Login rate limit. `createLoginRateLimiter` allows 10 failures per 15 minutes per address and skips successes (`login.ts:158-162`). `loginSync` answers a bad HMAC with 400 (`routes/api/login.ts:109`), which the limiter counts. This does not cover `POST /set-password`.
- Share credential check and protected notes. `hasCredentialAccess` uses `constantTimeCompare` on the raw credential label (`handlers.ts:590-613`). `checkNoteContentAccess` 404s protected notes before `getContent` (`handlers.ts:555-582`), including the `shareRaw` branch (`handlers.ts:164-166`). Shaca loads only the `_share` subtree (`shaca_loader.ts:18-30`).
- MCP authentication. `resolveMcpAccess` denies when the feature is off or the ETAPI token is missing, including from loopback (`mcp.ts:97-108`). The route does not use the session cookie (`mcp.ts:65-67`).
- ETAPI authentication wrapper. `checkEtapiAuth` requires a valid token unless `noAuthentication` was true when the module loaded (`etapi_utils.ts:17`, `47-52`). Token hashes use a constant-time compare. Handler-level IDOR inside ETAPI was not re-read; a token is the owner.
- Backend scripting default. `backendScriptingEnabled` and `sqlConsoleEnabled` default false (`config.ts:551-562`). `/custom` handlers 403 while scripting is off (`custom.ts` in core, `95-97`).
- CSRF secret binding. The CSRF cookie is `httpOnly` and `sameSite: strict` (`csrf_protection.ts:11-19`). It is skipped for the internal Electron symbol and while the database is uninitialized (`csrf_protection.ts:48-59`), which matches the comment that there is no authenticated session to ride yet.
- Reverse-proxy client IP. Default does not trust `X-Forwarded-For` (`www.ts:135-137`).
- SQL on the request path that was sampled. Search and sync pull use bound parameters (`sync.ts` `getChanged`, the `?` placeholders). `queueSector` runs `sanitizeSqlIdentifier` (`sync.ts:378-380`). `eraseEntity` allow-lists the table name before interpolating it (`sync_update.ts:196-205`).
- Sync identifier interpolation, not raised as a defect above Info. `sql.insert` concatenates `tableName` and column names (`sql.ts:87-105`), and `updateNormalEntity` passes `remoteEC.entityName` and the remote row through (`sync_update.ts:97`). Shaca builds an `IN (...)` list from note ids (`shaca_loader.ts:32-38`). `isValidEntityId` is `/^[A-Za-z0-9_]{4,128}$/` (`utils/index.ts:57-58`) on ETAPI and on forced ids in `createNewNote`. Sync `replace` does not call it. A peer that already completed `loginSync` can already pull and push the document, so a quote in a note id would not cross a trust boundary this review can see. Left as residual, not a finding.
- `noAuthentication` default false. When an operator sets it, auth is intentionally off. `etapi_utils.ts` captures the flag at import, while `auth.refreshAuth` can refresh the session gate. That skew matters in tests that flip the flag without re-importing. It was not treated as a production bypass.
- Health check unauthenticated `{ status: "ok" }` (`routes.ts:122`).

## Break-It Review

Done as a static trace. No playtest and no live request, by the operator's instruction and by read-only authority.

| Mechanism | Attack considered | Result |
|---|---|---|
| Password login | Missing TOTP, wrong password | Refused in `verifyLoginCredentials`. Rate limited. |
| TOTP bypass | Password only, via sync-seed then sync login | Guard absent. `SEC-TRI-001`. |
| First password | Anonymous POST to a published port | Guard absent. `SEC-TRI-003`. |
| IDOR on notes | Second user | No second user. Not a test. |
| Share foreign note | Note id outside the share subtree, protected note, missing Basic credentials | Refused in the handlers that were read. |
| Clipper without a token | Server build | `checkEtapiToken`. Desktop build: no token. `SEC-TRI-002`. |
| Clipper labels | `shareRaw`, `customResourceProvider` | Names survive sanitizing. UI danger flag is not enforced. |
| CSRF on `apiRoute` POST | Cookie without `x-csrf-token` | Middleware present. Not executed. |
| CSRF on sync PUT | Same-site cookie, no token | Middleware absent. `SEC-TRI-004`. Cross-site not claimed. |
| Sync HMAC | Bad hash, clock skew | 400 and 401 respectively. Constant-time compare. |
| `file:` image | Scheme other than http(s) | Rejected. Private http is not. `SEC-TRI-006`. |
| Custom handler RCE | Scripting default | 403. Resource GET has no auth. `SEC-TRI-005`. |
| MCP without a token | Loopback | 401. |
| Header spoof of the Electron bypass | Attacker header or JSON field | Symbol key. Not settable that way. |
| Forged `X-Forwarded-For` | Default config | `trust proxy` unset. |

## Analysis

The product is a single-owner store. After a normal login the session is the owner, and object-level ACLs would not match the product. The defects are places that mint or replace that session, or that write, without the checks the main API already uses.

TOTP is implemented once, in `verifyLoginCredentials`, and two older credential doors were not moved onto it. `checkCredentials` is password-only and it is what hands out `documentSecret`. `loginSync` then treats that secret as a full login. Anyone reviewing only `POST /login` would conclude that TOTP holds. The pair of sync routes is the bypass.

The desktop listener has the same shape. MCP was corrected so that loopback is not a credential. The clipper still uses an empty middleware list on Electron, and the network-access flag, whose comment says it exists so another device can sync, disables the Host check for every path. Sync itself has an HMAC. The clipper does not. The opt-in is wider than the feature it was added for.

First-run password setup is the third member of the set. Later setup, when a database is already behind the wizard, got `checkSetupAuth`. The empty-database claim did not. The default route and the published compose port make the missing token reachable.

CSRF, `/custom`, and image download are the same pattern at lower impact: a special-case route or fetcher that does not use the guard the neighboring route uses (`csrfMiddleware`, a session, a private-address deny).

What held, and should stay the model for the repairs: session plus CSRF on `apiRoute`, the Electron symbol instead of a process-wide bypass, constant-time compares, share subtree loading, protected-note refusal, MCP's unconditional token, and scripting off by default.

## Skill Escalation

| Finding | Primary Lens | Secondary Lens | Why |
|---|---|---|---|
| SEC-TRI-001 | audit-security | audit-dataflow-temporal | The sync login timestamp window and the session lifetime are different clocks. A sync-scoped session, if added, needs an expiry review. |
| SEC-TRI-002 | audit-security | audit-security-llm | Clipper and MCP both sit on the desktop listener. MCP token checks were sampled. Tool agency, prompt injection, and confused-deputy tool calls were not. |
| SEC-TRI-002 | audit-security | audit-workflow-gui | The LAN opt-in is presented as sync access. The UI does not say it also opens the clipper. |
| SEC-TRI-004 | audit-security | audit-dataflow-input-output | A forged sync body is an import path. Zip and ENEX import were not reviewed. |
| SEC-TRI-005 | audit-security | audit-security-nodejs | `/custom` is dynamic dispatch by label. SECN dynamic execution belongs in that lens if scripting is enabled. |
| SEC-TRI-006 | audit-security | audit-dataflow-input-output | The URL is content that becomes a network fetch. Redirect handling in `request.getImage` was not read. |
| SEC-TRI-008 | audit-security | audit-security-owasp | CSP and share HTML sit on the XSS categories. No bypass was confirmed, so the OWASP matrix was not filled. |
| Share search and script bundle | audit-security | audit-security-llm | Not reviewed deeply enough to file. `getScriptBundle` serves script source to share visitors who may read the note. |

## Recommended Patch Order

1. `SEC-TRI-001`. TOTP-enabled servers are not second-factor protected until this is fixed.
2. `SEC-TRI-002`. Desktop network access should not publish a writer with no token.
3. `SEC-TRI-003`. A fresh reachable server should not be claimable with a 4-character POST. The bind default needs an owner decision; the setup token does not.
4. `SEC-TRI-004`. Put the existing CSRF middleware on the sync writes.
5. `SEC-TRI-006`. Refuse private and link-local image fetches.
6. `SEC-TRI-005`. Decide whether `/custom` resource notes are public, and enforce that decision on the server.
7. `SEC-TRI-007`. Hide live sync counters behind the session.
8. `SEC-TRI-008`. A CSP, only with a browser pass the owner runs. Not this audit.

## Regression Test Strategy

| Test | Purpose | Finding |
|---|---|---|
| TOTP on, password only, `GET /api/setup/sync-seed` is 401 and the body has no secret | Second factor actually gates the secret | SEC-TRI-001 |
| TOTP on, valid code, sync-seed still returns the secret | Pairing still works | SEC-TRI-001 |
| `loginSync` session cannot call a non-sync `apiRoute` if the session is split | Sync proof is not a browser login | SEC-TRI-001 |
| Electron, `allowLanAccess` true, clipper POST without a token is 401 and writes nothing | LAN opt-in is not a credential | SEC-TRI-002 |
| Electron, `allowLanAccess` false, clipper with a non-loopback Host is 403 | DNS rebind stays closed | SEC-TRI-002 |
| Fresh data dir, `POST /set-password` without the setup token does not set a password | First claim is closed | SEC-TRI-003 |
| Cookie session, no CSRF header, `PUT /api/sync/update` is 403 and the row count is unchanged | Sync writes match other mutations | SEC-TRI-004 |
| `customResourceProvider` without a public grant is 401 | Publish is explicit | SEC-TRI-005 |
| Note HTML with `img src` of `http://127.0.0.1/` creates no socket and no attachment | Address policy | SEC-TRI-006 |
| Initialized instance, no cookie, `GET /api/sync/stats` is 401 | Counters are not public | SEC-TRI-007 |

## Deferred Risks

- Sync `replace` interpolating table and column names, and shaca interpolating note ids. Exploitable only by a writer who is already inside the document trust boundary, unless a future writer stores a note id outside `[A-Za-z0-9_]`.
- OpenID redirect, token, and state handling. Not read. SSO can replace the password form (`login.ts:80-83`).
- Import zip slip, ENEX, and OneNote. Not read.
- Share sanitizer bypass and `shareRaw` HTML as an origin-equivalent XSS. Sanitizer is applied on the normal render path. No bypass hunt.
- Electron preload and `shell.ts` `execFile`. Not read. A compromised renderer is largely the owner already.
- Web-clipper extension origin checks. Not read. Server-side clipper auth was.
- LLM tool `execute` and MCP tool authorization beyond the bearer check. Escalated.
- `partialRequests` memory growth on authenticated partial sync uploads. Not measured. Confidence would be capped at Likely even if it were filed.
- Password minimum length 4. Folded into `SEC-TRI-003` as policy, not a separate finding.
- `etapi_utils.ts` captures `noAuthentication` at import time. Test-only skew unless config is edited and the process is not restarted.

## Validation Limits

Not executed: playtest, browser, curl against a running server, Docker, TOTP login, clipper from a second machine, CSRF from a second origin. The operator forbade playtest. The skill ceiling is read-only. Missing runtime proof does not raise these findings, because each one is a missing check in the middleware or the handler, and it does not lower them to Plausible.

Not inspected, and therefore not cleared:

- `apps/server/src/etapi/*` beyond the auth wrapper
- `apps/server/src/services/open_id.ts`
- `apps/desktop/src` preload, protocol, and shell handlers, except the host and gate behavior cited above
- `apps/web-clipper`
- `packages/trilium-core/src/services/import`
- `packages/trilium-core/src/services/llm`
- `apps/standalone` service worker and `apps/mobile`
- Share search, script bundle, and the sanitizer allow-list, beyond the calls cited
- Dependency CVEs and lockfile review
- `request.getImage` redirect policy

`apps/server/spec/db/config.ini` sets `noAuthentication=true` for tests. That is the test harness, not the shipping default (`config.ts` default `false`).

## Residual Risk

An owner who enables TOTP and still uses a password that has appeared elsewhere is exposed until `SEC-TRI-001` ships. A desktop with network access enabled is exposed on the LAN until `SEC-TRI-002` ships. A freshly published server is exposed until the first password is set by the operator, and today that race has no token.

Share, ETAPI handlers, OpenID, import, and LLM tools can still hide a higher-severity issue. This report does not clear them.

## Final Confidence

Medium, for the findings that are filed. Each cited guard or missing guard was read at the listed line. Confidence is not High for the product as a whole, because the surfaces under Validation Limits were not reviewed and no request was sent.

## Next Action

Patch `SEC-TRI-001` first: send `checkCredentials` and the sync-seed route through `verifyLoginCredentials`, and add the two regression specs in the table above. Do not treat that as permission to change code in this session; the ceiling here was the report.

## Files Inspected

- `apps/server/src/services/auth.ts`
- `apps/server/src/services/electron_request.ts`
- `apps/server/src/services/config.ts` (mapping sections, not every key)
- `apps/server/src/services/host.ts`
- `apps/server/src/services/desktop_network_gate.ts`
- `apps/server/src/services/etapi_tokens.ts` (create and compare)
- `apps/server/src/services/utils.ts` (`constantTimeCompare`)
- `apps/server/src/services/ws_messaging_provider.ts` (verifyClient)
- `apps/server/src/routes/routes.ts`
- `apps/server/src/routes/route_api.ts` (through the multer helpers)
- `apps/server/src/routes/csrf_protection.ts`
- `apps/server/src/routes/session_parser.ts`
- `apps/server/src/routes/login.ts`
- `apps/server/src/routes/api/login.ts`
- `apps/server/src/routes/api/clipper.ts`
- `apps/server/src/routes/custom.ts`
- `apps/server/src/routes/index.ts` (bootstrap auth branches)
- `apps/server/src/routes/mcp.ts` (guard, not the MCP SDK handler)
- `apps/server/src/app.ts`
- `apps/server/src/www.ts` (trust proxy and scripting log)
- `apps/server/src/etapi/etapi_utils.ts` (auth wrapper)
- `packages/trilium-core/src/routes/index.ts` (registration list)
- `packages/trilium-core/src/routes/api/setup.ts`
- `packages/trilium-core/src/routes/api/sync.ts`
- `packages/trilium-core/src/routes/custom.ts`
- `packages/trilium-core/src/services/setup.ts` (`getSyncSeedOptions` and the sync-from-server error path)
- `packages/trilium-core/src/services/sync_update.ts`
- `packages/trilium-core/src/services/sql/sql.ts` (`insert` / `replace`)
- `packages/trilium-core/src/services/utils/index.ts` (`isValidEntityId`, `sanitizeSqlIdentifier`, SVG CSP)
- `packages/trilium-core/src/services/sanitizer.ts`
- `packages/trilium-core/src/services/image_download.ts` (the fetch decision)
- `packages/trilium-core/src/services/options_init.ts` (the one default cited)
- `packages/trilium-core/src/share/handlers.ts` (access checks and raw/SVG branches)
- `packages/trilium-core/src/share/shaca/shaca_loader.ts`
- `packages/trilium-core/src/becca/entities/boption.ts` (`getPojo`)
- `packages/trilium-core/src/becca/entities/battribute.ts` (`beforeSaving`)
- `packages/commons/src/lib/builtin_attributes.ts` (dangerous flags cited)
- `docker-compose.yml`

## Self-Check

- Confirmed findings quote lines that were read.
- Severity is from reach and impact. TOTP bypass is High because the factor is skipped, not because the category name is "auth."
- First-run claim is High only when the port is reachable; the finding says so. An empty database is why it is not Critical.
- No test suite was treated as proof.
- Playtest was not run.
- No product source was modified. This report is the only new file.


## Remediation checkpoint — 2026-10-14

Authorized scope: all eight SEC-TRI findings, local patches and tests; no commit or deployment. Baseline: main @ bad01ff7e6; only this audit was untracked. Dependencies were absent; frozen-lockfile installation is in progress, baseline tests unknown.

Stage plan (security throughout):
1. Authentication and sync: SEC-TRI-001 (P0/medium), 002 (P0/low), 004 (P2/medium), 007 (P3/low). Shared auth/route/session boundaries; preserve normal password/token login, trusted Electron renderer and sync payloads; test factor checks, scoped sync proof, cookie-only CSRF refusal, clipper tokens and stats authentication. Sync clients must carry the new session proof.
2. First password: SEC-TRI-003 (P0/medium). Startup secret, password route and form; preserve renderer exemption and configured bind address; test missing/wrong/expired token, success and repeat claim.
3. Custom publication: SEC-TRI-005 (P2/medium). Core dispatch, Express authentication callback, built-in label and docs; preserve matching/script toggle behavior; require explicit customPublic for anonymous access, session+CSRF or ETAPI otherwise.
4. Image transport: SEC-TRI-006 (P2/medium). Existing Node validation/pinning already present; verify and close desktop/proxy redirect and DNS gaps without weakening private-address policy.
5. CSP: SEC-TRI-008 (P3/medium). App shell inline script and share boot script; introduce an explicit compatible policy, no blanket Helmet defaults. Header/static tests; browser verification remains a stated limitation under repository guidance.

Governing sources: CLAUDE.md (active core/runtime boundaries, tests and documentation), CONTRIBUTING.md, core RequestProvider/ExecOpts, SharedRouteDependencies, express-session augmentation, share templates and existing HTTP contract specs. Baseline conforms to runtime architecture; supplied omissions are security defects. Intentional security contract amendments are authorized by the request and must update producers, consumers, tests and User Guide together. No schema migration or database-format change planned. Stages 1/2 share auth/bootstrap; stage 3 consumes stage 1 auth; CSP covers all HTML. No other deferred audit observations are included.


## Remediation closure — 2026-10-14

Fix pointer / session log: this file's remediation checkpoint and closure addendum; local working-tree patch based on `bad01ff7e6`. No commit, PR, deployment, production configuration change or credential rotation was performed. All eight supplied findings were included; the audit's separate deferred risks were not silently added.

| Finding | Current disposition | Repair and evidence |
| --- | --- | --- |
| SEC-TRI-001 | Fixed; regression verified | Sync-seed credentials use password plus TOTP/recovery verification inside a CLS context. A real TOTP pairs once, records its time step and cannot be reused. Sync HMAC login regenerates the session and issues a fixed one-hour, header-bound sync grant; it never sets browser `loggedIn`. A sync proof cannot read ordinary note APIs or invoke administrative sync actions. `security_boundaries.spec.ts`, `api/login.spec.ts`, core `sync.spec.ts` and all request-provider specs cover server and consumer behavior. |
| SEC-TRI-002 | Fixed; regression verified | Clipper routes require ETAPI authentication on every build. Desktop/LAN HTTP requests without a token return 401 and create no note; a valid token creates a clipping. The extension stores a desktop token locally and sends it for discovery and subsequent calls. Existing loopback-host gate coverage remains green. |
| SEC-TRI-003 | Fixed; regression verified | A 256-bit process-local console token expires after an hour and is required for first password, database installation, restore, seed pushes and initial sync login. Preinitialized API access also needs console/setup/sync proof. Missing/wrong/expired tokens fail; UTF-8 length mismatch cannot crash constant-time comparison. Case-insensitive and trailing-slash setup paths are guarded. The actual password-persistence HTTP test verifies refusal leaves the password unset, success persists it, and a later claim cannot replace it. Trusted renderer and explicit no-auth exemptions remain. Startup/form/wizard, and temporary host-bound sync seeding token, are wired through all transports. Configured bind and TLS settings are unchanged. |
| SEC-TRI-004 | Fixed; regression verified | All four sync mutations use CSRF middleware. Browser cookie-only calls return 403; valid browser CSRF and valid scoped sync-header proof work. The sync proof is unavailable to an ordinary forged browser form and expires independently of the cookie. |
| SEC-TRI-005 | Fixed; regression verified | Core dispatch asks the HTTP host to authorize the selected note before bytes or code. Private routes accept an owner session (with CSRF for mutations) or ETAPI token. Anonymous access needs an owned `customPublic` label; inherited grants and explicit false do not publish. Backend scripting remains independently gated. Existing handler, async response-listener and resource-provider tests pass. |
| SEC-TRI-006 | Fixed remaining transport gap; regression verified | The existing Node private-address, credential/scheme, DNS-resolution and pinned-lookup checks were already present. Desktop images now select the same direct Node transport instead of Electron's independently resolving, auto-redirecting transport. Sync proxies cannot bypass image pinning. Images reject redirects and private/link-local destinations; normal public-image byte handling and sync proxy behavior remain covered. |
| SEC-TRI-007 | Fixed; regression verified | Sync stats require authenticated browser, setup or scoped sync authority. Anonymous initialized-instance and first-run requests return 401; legitimate authenticated reads work. |
| SEC-TRI-008 | Implemented; partial runtime verification | An explicit enforced CSP covers app and share responses. A fixed hash permits only the existing app boot shim, while per-response nonces permit the trusted share boot script and Vite development injection. Script attributes and objects are refused. Required script-note evaluation, WASM/workers, CSS, images, media, frames and network connections retain explicit allowances. Tests verify the shell hash, distinct nonces, actual share response nonce matching and development shell substitution. No browser editor smoke test was run, per repository guidance; policy compatibility with every editor/plugin remains unverified. |

### Stage and verification results

Stages 1–5 from the checkpoint are implemented. Authentication/sync owns the session and wire contract; first-run setup reuses its header-capable transports; custom dispatch consumes the owner authentication boundary; image transport keeps sync's operator-configured transport separate from content downloads; CSP covers all HTML responses. This grouping kept shared contracts consistent rather than fixing just the registration lines.

Targeted checks on the final relevant code (not the full repository suite):

| Check | Result | Evidence |
| --- | --- | --- |
| `pnpm --filter server test` with the 26 affected auth, setup, sync, custom, clipper, request, share and CSP spec files | 464 passed | `/tmp/trilium-server-final-green.log`; subsequent changed-path checks: `/tmp/trilium-first-run-final.log`, `/tmp/trilium-boundaries-complete.log` |
| `pnpm --filter standalone test` with 10 affected core/setup/sync/share and browser/native-bridge request-provider specs | 276 passed | `/tmp/trilium-standalone-final-green.log` |
| `pnpm --filter client test src/set_password.spec.tsx src/setup.spec.tsx src/setup_unlock.spec.tsx src/widgets/type_widgets/options/sync.spec.tsx` | 62 passed | `/tmp/trilium-client-final-green.log` |
| `pnpm --filter web-clipper test entrypoints/options/options.spec.tsx entrypoints/background/trilium_server_facade.spec.ts` | 28 passed | `/tmp/trilium-clipper-final.log` |
| `pnpm --filter desktop test src/services/request.spec.ts` | 4 passed | `/tmp/trilium-desktop-tests.log` |
| `pnpm --filter share-theme test src/templates/boot_script.spec.ts` | 4 passed | `/tmp/trilium-theme-final.log` |
| `pnpm typecheck` | No errors | `/tmp/trilium-typecheck-closed.log` |
| `node .claude/skills/writing-documentation/docs.mjs sync` and `check` | Generated help updated; 0 errors, 68 warnings | `/tmp/trilium-doc-sync-final.log`, `/tmp/trilium-doc-check-final.log` |
| `git diff --check` | Clean | Final working-tree check |

That is 838 passing targeted test executions across the listed projects, including shared specs under both runtimes. Initial test runs exposed expected old-contract assertions (sync browser login, image proxy behavior, first-run API bypass, optional second-factor argument) that were updated to check the repaired contract. A real-TOTP regression additionally exposed missing middleware CLS context; its red run is `/tmp/trilium-real-totp-red.log`, and the final test records successful consumption plus refusal of reuse. A new sync-proof propagation assertion initially lacked request-header state in its test recorder; the recorder now snapshots the cookie jar and proves the proof reaches sync calls. These failures were diagnosed, not suppressed.

### Baseline, equivalence and closing inspection

Baseline tests were unknown because dependencies were absent. `pnpm install --frozen-lockfile` completed without changing package manifests or the lockfile. The pre-edit baseline for the touched functions was captured from their source branches and existing specs. Representative non-defect paths were rechecked: ordinary password/ETAPI/recovery login, session regeneration, protected share access, cookie persistence, sync payloads and counters, server proxy requests, public image bytes, custom handler matching/scripting toggle/response-listener context, static exports and setup failure preservation. This is representative regression evidence, not an exhaustive equivalence proof.

First closing pass traced the changes through Express ordering, session persistence, first-run/partial-sync states, all three sync request providers, custom dispatch and response headers. It caught and closed the middleware context issue and case-insensitive/trailing-slash first-claim paths. A distinct completeness pass matched each original SEC-TRI reproduction to its HTTP/unit regression, checked consumer wiring and protocol versioning, inspected the union of diffs for stale comments, unintended declaration changes and secret logging, and checked generated documentation. No unresolved in-scope code gap was identified by those passes; they are self-review, not an independent security audit.

Architecture comparison: `CLAUDE.md`, `CONTRIBUTING.md`, `RequestProvider`/`ExecOpts`/`CookieJar`, Express session augmentation, shared route dependencies, share request/render contracts, existing transport specs and User Guide remain the governing sources. Runtime dependencies stay Node-only in server/desktop; core has no new Node imports, database schema or stored-data format changes. The intentional security amendments are complete across producers/consumers/types/tests/docs: sync protocol 41, console setup proof, clipper tokens, explicit custom publication and CSP. Drift delta: intentional authorized amendments complete, with browser/CSP compatibility verification still partial.

Documentation closure: the mutable current disposition is this addendum, leaving the original audit intact. Nine User Guide pages and their generated help were refreshed for authentication/setup/CSP, synchronization/TOTP/proxies, desktop network access, clipper tokens, custom grants and labels. No separate repository defect ledger exists to update. No external record update was attempted.

Compatibility and residual limits: upgrade sync peers together to protocol 41; update the desktop clipper extension and configure its ETAPI token; add `customPublic` only to custom routes intended for anonymous access. Fresh servers need their console token, including when seeded from a desktop. Automatic server/desktop image downloads now bypass sync proxies and refuse redirects. CSP retains `unsafe-eval` for the supported scripting runtime; it is a containment backstop, not a sanitizer replacement. Browser/editor/plugin smoke tests, real LAN-device checks, packaged production builds and the full CI suite were not run. The original audit's deferred risks remain outside this patch set. CSP design references: [Helmet CSP](https://github.com/helmetjs/helmet/blob/main/middlewares/content-security-policy/README.md) and [MDN script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src).

Final patch-set status: **completed_with_partial_verification**. All eight findings have local patches; CSP/editor behavior still needs browser verification. Changes are left uncommitted for review.
