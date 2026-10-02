# Security Policy

## Supported Versions

Only the latest stable minor release receives security fixes.

For example, if the latest stable version is 0.92.3 and the latest beta is 0.93.0-beta, then only the 0.92.x line will receive security patches. Older versions (like 0.91.x) will not receive fixes.

This policy may be altered on a case-by-case basis for critical vulnerabilities.

## Reporting a Vulnerability

**Please report all security vulnerabilities through [GitHub Security Advisories](https://github.com/TriliumNext/Notes/security/advisories/new).**

We do not accept security reports via email, public issues, or other channels. GitHub Security Advisories allows us to:
- Discuss and triage vulnerabilities privately
- Coordinate fixes before public disclosure
- Credit reporters appropriately
- Publish advisories with CVE identifiers

### What to Include

When reporting, please provide:
- A clear description of the vulnerability
- Steps to reproduce or proof-of-concept
- Affected versions (if known)
- Potential impact assessment
- Any suggested mitigations or fixes

### Response Timeline

- **Initial response**: Within 7 days
- **Triage decision**: Within 14 days
- **Fix timeline**: Depends on severity and complexity

## Scope

### In Scope

- Remote code execution
- Authentication/authorization bypass
- Cross-site scripting (XSS) that affects other users
- SQL injection
- Path traversal
- Sensitive data exposure
- Privilege escalation

### Out of Scope (Won't Fix)

The following are considered out of scope or accepted risks:

#### Self-XSS / Self-Injection
Trilium is a personal knowledge base where users have full control over their own data. Users can intentionally create notes containing scripts, HTML, or other executable content. This is by design - Trilium's scripting system allows users to extend functionality with custom JavaScript.

Vulnerabilities that require a user to inject malicious content into their own notes and then view it themselves are not considered security issues.

#### Published (Shared) Note Content
A shared note is published by its owner, and the share view renders it as it was authored, raw HTML included. Script running on a page you publish is not an escalation of anything: Trilium supports it deliberately, through the `~shareJs` relation, which loads a JavaScript note of your choosing into the share page, and through `~shareTemplate` for the page around it.

Reports that reduce to "a note's own HTML or JavaScript executes for visitors to the page publishing it" are therefore out of scope, however the content was written (editor, ETAPI, sync). Content arriving through the importers and the web clipper is sanitized on write, independently of this.

What crosses out of the published page remains **in scope**: disclosing notes that were never shared, bypassing `#shareCredentials` or `#shareHiddenFromTree`, or reaching the authenticated session of someone who merely visited. So does a defect in how the share renderer itself builds markup, such as a value escaping the attribute it was placed in; we fix those as correctness bugs even where the value was the publisher's own.

#### Collaboration Guests
A collaboration (Advanced Usage → Collaboration) opens one note, or its subtree, to guests through a link, with viewing, editing and adding child notes each either open to anyone with the link or behind a password the host sets. The host chooses who can do what, so a guest editing a note the host opened to editing, or an edit made by whoever holds the link to an "anyone can edit" collaboration, is the feature working as configured and out of scope.

What a guest can reach beyond that grant is **in scope**: reading or changing a note outside the collaboration (including a protected note inside it), setting any attribute other than a note's `color` and `iconClass` labels and a guest-editable code note's `tabWidth` and `indentWithTabs` labels, editing or creating with a capability the session never unlocked, obtaining the host's authenticated session or any `/api` or ETAPI access from a guest cookie, saving content that bypasses the sanitizer or the size cap, storing a diagram, canvas or mind map preview that keeps script, event handlers or a link that runs code, saving a mind map that keeps markup Mind Elixir writes into the page (`dangerouslySetInnerHTML`, arrow and summary labels) or a node picture the map did not already hold, getting a collection's leftover content printed into a page, changing a code note your Trilium runs or renders (Trilium frontend and backend JavaScript, JSX, the SQL console, HTML) or switching a note into one of those types or into a type the guest page has no editor for (render, web view, relation map, saved search, note map, AI chat, spreadsheet), or getting past the guest limit, the login rate limit or the CSRF check on a write. A note's own scripts never load on the guest page; server-side scripts attached to a collaborated note do run when a guest edits it, as they do for ETAPI and web clipper writes, and that is by design.

Every person on a collaboration's pages is listed by name, and everyone who can edit a note shares their cursor with the others on it. A guest choosing their own name, including a name such as "Host" (the host's row carries a tag no guest can get), is by design. What reaches past that is **in scope**: renaming or removing anyone, or changing their color for others, without being the host, taking the host's place in the list (its id, color or tag), staying connected or keeping a capability after the host removed you, learning another guest's session or guest id from what a page receives, sharing a cursor from a page that cannot edit or into a note outside the collaboration, or getting markup from a name or a cursor into another person's page or into the host's app.

#### Electron Architecture
The desktop application follows the Electron security checklist: `nodeIntegration` is disabled, `contextIsolation` is enabled, and the renderer can only reach the main process through a whitelisted `contextBridge` API (`window.electronApi`). Embedded web content (Web View notes) is isolated in a dedicated session partition with deny-by-default permission handlers, `<webview>` attach requests are vetted in the main process, and window-open/navigation requests are checked against a scheme allowlist. Electron fuses additionally prevent external abuse.

User scripting (see Self-XSS above) still intentionally allows arbitrary JavaScript in the renderer, so reports that reduce to "a user script can call the frontend API" remain out of scope. Renderer-to-main escapes, however, **are in scope**: gaining Node.js access from the renderer, bypassing the preload bridge whitelist, or escaping the webview isolation.

#### Authenticated User Actions
Actions that require valid authentication and only affect the authenticated user's own data are generally not vulnerabilities.

#### The CSRF Token Being Readable From the Page
`glob.csrfToken` is readable by any script running on the page, and it is meant to be: the client attaches it to every internal API call as the `x-csrf-token` header, so a token the client could not read would be a client that could not reach its own backend. The half that must stay out of reach is the `trilium-csrf` cookie, which is `httpOnly` and `sameSite: strict`, and does.

That pairing is the whole of what a double-submit token claims to do. It establishes that a request came from our own page rather than from someone else's, and it was never a barrier to anything already running on our page. Concealing the value would not change that either: `./bootstrap` issues a fresh, valid token to any same-origin request carrying the session cookie, which is how the client itself recovers from an expired one.

So "the CSRF token can be read out of the page" is not a finding on its own, and neither is the follow-on that script holding it can call the internal API as the logged-in user. That describes what script execution is worth, not how it was obtained — and only the second half is a vulnerability.

**How it was obtained is the report we want.** Any path that gets JavaScript running in the app from content the user did not author — an imported note, a note arriving over sync, a clipped page, a filename, an attribute value — is in scope, however small the resulting foothold looks. So is a real failure of the protection: a state-changing endpoint that accepts a cross-origin request, a token that validates against a session other than the one it was issued for, or the session cookie losing `httpOnly` or its `sameSite` attribute. On the desktop the check is deliberately skipped for requests the renderer dispatches over the `trilium-app://` protocol, where Express sessions do not round-trip and there is nothing to validate against; requests reaching the desktop's HTTP listener over TCP are checked in full, and a way to have one treated as the other is in scope.

#### Private Addresses Reached by a Configured LLM Endpoint
Outbound requests the server makes on behalf of note content — link previews, image fetches, imports — are vetted against a strict rule: the hostname is resolved, every address behind it must be a public unicast one, and the connection is pinned to the addresses actually checked. Note content is not entitled to the network its host can see.

An LLM provider's base URL is not note content, and the same rule cannot apply to it. Running a model locally is the reason several of the providers exist: Ollama and LM Studio both default to `localhost`, and either is as likely to be another machine on the LAN. A server that refused those addresses would not be a safer Trilium, it would be one where local models do not work at all. So for that destination — and only that one — loopback, RFC1918 and unique-local addresses are deliberately permitted.

Reports that reduce to "an authenticated user can point the LLM base URL at a host on the local network, and the server connects to it" are therefore out of scope, including the reachability and port information that connecting necessarily reveals.

What stays refused is what no model server is ever served on: link-local (`169.254.0.0/16`, which is where a cloud instance answers with its own credentials) and carrier-grade NAT (`100.64.0.0/10`, likewise). Redirects are not followed on these requests at all, since the hop would carry the configured API key to whoever the endpoint named. Defects in **those** guards are in scope, as is any path that reaches them without authentication.

#### Denial of Service via Resource Exhaustion
Creating extremely large notes or performing many operations is expected user behavior in a note-taking application.

#### Missing Security Headers on Non-Sensitive Endpoints
We implement security headers where they provide meaningful protection, but may omit them on endpoints where they provide no practical benefit.

## Coordinated Disclosure

We follow a coordinated disclosure process:

1. **Report received** - We acknowledge receipt and begin triage
2. **Fix developed** - We develop and test a fix privately
3. **Release prepared** - Security release is prepared with vague changelog
4. **Users notified** - Release is published, users encouraged to upgrade
5. **Advisory published** - After reasonable upgrade window (typically 2-4 weeks), full advisory is published

We appreciate reporters allowing us time to fix issues before public disclosure. We aim to credit all reporters in published advisories unless they prefer to remain anonymous.

## Security Updates

Security fixes are released as patch versions (e.g., 0.92.1 → 0.92.2) to minimize upgrade friction. We recommend all users keep their installations up to date.

Subscribe to GitHub releases or watch the repository to receive notifications of new releases.
