# Gosling
Gosling is a generic provider gateway for Trilium chat notes: **Trilium chat → local Gosling ACP process → selected Gosling provider/model**. Gosling owns provider authentication, agent execution, permissions and tools. Trilium owns the chat, selected note context and note operations.

## Setup

1.  Build the companion Gosling revision with bounded client tool policy v1 (`cargo build -p gosling-cli` from the Gosling checkout, after `source bin/activate-hermit`). Use a build that includes the features your providers require.
2.  Configure and authenticate providers using Gosling's existing `gosling configure` flow. Keep subscription authentication in Gosling. This integration never substitutes a separately billed API route.
3.  Start Trilium with `TRILIUM_GOSLING_BINARY` pointing to that build's absolute executable path. Without it, Trilium looks for `gosling` on the server's PATH. The executable runs on the machine hosting Trilium, including for a browser client.
4.  In **Options → AI / LLM**, add **Gosling** under **Custom endpoint**. No API key or URL is required. Choose models from Gosling's inventory and save.
5.  Create a chat note and select the desired Gosling provider/model in its model picker. The in-editor assistant requires a different provider; Gosling currently requires a persistent chat note.

Gosling starts as `gosling acp` over local stdio. No Gosling HTTP server, LAN access, cloud synchronization or analytics is enabled. Provider inference can still use an external endpoint: check the endpoint label and Gosling's configuration before sending sensitive content. **Unknown** means Gosling could not establish locality from non-secret endpoint metadata; it is not a claim of local inference.

## Inventory and capabilities

The model picker uses exact provider/model identifiers from Gosling. Display names do not determine routing. Reopen the provider's model selection and choose **Refresh Gosling inventory** after changing Gosling configuration. Background refresh completion updates the list without rebuilding Trilium; select newly available models and save.

Configured, not configured, stale, refreshing, failed-refresh and expired-credential states are shown separately. Configuration or a model listing does not demonstrate subscription entitlement, live authentication or successful inference. These authentication states are shown only when Gosling explicitly reports them; otherwise authentication remains unverified. An expiry is a warning: Gosling may refresh the credential on use. Authentication failures should be resolved in Gosling; Trilium does not open a replacement API account or copy provider secrets.

Only configured providers supply selectable models. Providers with no reported models need configuration or inventory refresh in Gosling. Applicable reasoning values come from the inventory. Native images and binary file attachments are disabled because inventory does not establish their support. Text attachments remain available. Pricing and subscription coverage are not guessed.

Providers that execute tools inside their own CLI/runtime cannot enforce this bounded tool policy. They remain visible with an explanation, but chat execution is blocked. Changing a client toggle cannot sandbox those runtimes. This restriction applies to the reported capability, without a vendor allowlist.

## Notes and additional tools

**Note access** controls note tools and the current-note context hint. The bounded initial workflow exposes the existing note search, metadata, content, create, rename, edit, append and delete tools. It does not grant database-file access. Note access is off by default for a new chat note.

With access on, notes are read-only until **Gosling session permissions → Allow proposed note writes** is enabled. A proposed edit is text describing a change. Applying it requires a separate tool invocation and approval; the tool result shows success or failure. Rejecting an approval does not apply the edit.

Every tool invocation requires an explicit once-only decision in the chat. Remembered global tool allows and autonomous mode do not bypass this boundary. The integration offers no “always allow” decision. A denial, expired request or failed tool is not a completed change.

Select additional enabled Gosling MCP extensions explicitly under **Gosling session permissions**. None are inherited automatically. This can include authorized Muninn, cephalopod-ai, Alexandria and math\_mcp configurations; their logic and credentials stay in their existing systems. The extension's configured tool allowlist remains effective. Configure a narrower allowlist in Gosling when only some tools should be exposed. Each invocation still requires approval. Extensions can make external connections independently of the model's endpoint label. The name `trilium` is reserved for this chat's note endpoint.

**Revoke access and cancel this turn** immediately removes the active note endpoint and cancels the chat's turn and pending approvals. The next session starts with access off and no additional extensions selected. Revocation removes capabilities, not note content already sent to a model or present in visible history. The public Trilium MCP setting is independent and need not be enabled.

## Sessions, switching and interruption

Each chat note maps to a separate Gosling session. Mappings live in `gosling-local/sessions.json` under this host's Trilium data directory, outside synchronized notes and options. Gosling owns execution history. Processes are shared across chats and stopped after an idle period; each turn has a separate revocable note capability.

Provider/model changes, changed access, edited history, a missing mapping or an interrupted turn require an explicit handoff. Select **Start a new Gosling session with the visible conversation on the next turn** to continue. This creates a new session from the visible transcript; it does not claim native continuation of provider-owned state. The previous mapping is preserved if creation or selection fails. No global Gosling default is changed.

After a process or application restart, an unchanged completed chat uses Gosling's session-load contract. A failed resume is reported; it never silently replays a prompt. Cancellation and incomplete streams are errors, and an uncertain turn requires a handoff before retry. Concurrent chats and cancellation are isolated.

## Isolated preview and returning to your installation

Build Trilium with `pnpm --filter server build`. To preview without opening your knowledge base, copy `packages/trilium-core/src/test/fixtures/document.db` into a new directory and create a `config.ini` there with `[General] noAuthentication=false` and `[Network] host=127.0.0.1` plus an unused port. For example:

```toml
[General]
noAuthentication=false
noBackup=true
[Network]
host=127.0.0.1
port=39162
https=false
[Sync]
```

Keep the port unused and synchronization unconfigured.

From the Trilium repository root, launch the build with these environment variables (replace the example paths):

```sh
TRILIUM_DATA_DIR=/absolute/path/to/isolated-profile \
TRILIUM_GOSLING_BINARY=/absolute/path/to/gosling/target/debug/gosling \
TRILIUM_ENV=production node apps/server/dist/main.mjs
```

Log in to the synthetic fixture with `demo1234`. On macOS, the rebuilt Gosling executable may need you to complete an existing-credential Keychain prompt on the desktop before inventory can load. Use synthetic prompts and notes for validation. Stop this preview process to return to your existing installation; launch that installation as usual without these environment overrides. No installation, notes migration or sync is required.