# Gosling ACP integration
Gosling is a host-process LLM provider that routes chat notes through a local ACP gateway. The integration reuses the ACP client, process pool, update collector and MCP note tools. Gosling owns credentials, provider inference, the agent loop and execution state; Trilium owns authored notes and presentation.

## Transport and discovery

The server starts `TRILIUM_GOSLING_BINARY` (default `gosling`) with `acp` over stdio. Its working directory is `gosling-local` inside Trilium's data directory. It neither opens a Gosling HTTP listener nor enables synchronization. The existing loopback MCP listener issues a separate random, revocable URL for each turn. The public MCP setting need not be enabled.

Discovery uses `_gosling/unstable/providers/list` with `includeHiddenConfigured: true`, plus the existing inventory refresh method. This includes configured custom and otherwise hidden providers. Exact provider/model identifiers are serialized as a JSON tuple; display names are never parsed for routing. Only configured providers contribute selectable models. Refresh does not change Gosling's global defaults.

Inventory distinguishes configuration, freshness, refresh progress/failure, endpoint locality and tool-execution ownership. Authentication is reported only when Gosling explicitly provides evidence through refresh errors or ACP authentication-required errors. Otherwise authentication and inference are unverified. Trilium does not enumerate credential stores or receive their contents. Expiry is a warning because Gosling may refresh a credential on use. No subscription-to-API fallback exists.

Reasoning values come from model metadata and use `session/set_config_option` with `thinking_effort`. Native image/binary attachments, unreported reasoning settings, Trilium's separate search loop and provider-owned runtime tools are rejected with explanations. Endpoint labels are `local`, `external` or `unknown`; selected endpoint locality is checked again before inference. Extensions may independently contact external services.

## Bounded client tool policy v1

The companion Gosling patch adds an opt-in contract to the existing ACP surface:

*   `initialize` advertises `_meta.goslingClientToolPolicyVersion: 1`.
*   `session/new` accepts `_meta.clientToolPolicy: {version: 1}` with an explicit `enabledExtensions` array, including an empty array. Provider and model are pinned through the existing session metadata.
*   New/load responses include `_meta.clientToolPolicy: {version: 1, providerId, modelId}`. Trilium verifies this receipt before prompting.
*   The policy persists as `client_tool_policy.v1` in Gosling's session extension data. Malformed stored policy fails closed. Resume preserves the selected extension identities and accepts replacement client MCP addresses only for previously selected names.
*   Every actual tool dispatch checks its host-owned extension identity against that persisted allowlist. A mandatory inspector requires host approval even when global mode or remembered tool settings would allow execution. An execution with no durable session fails closed.
*   Workspace/builtin tools, provider-owned tool runtimes, automatic provider fallback and ancillary configured context channels are disabled for bounded sessions. Ordinary ACP clients retain their previous defaults.
*   Inventory adds `executesToolsOutsideGosling` and non-secret `endpointLocation` fields. `includeHiddenConfigured` defaults to false for existing consumers. Generated schema and SDK types accompany these additions.

This policy is enforced in Gosling's execution path. A Trilium toggle alone cannot constrain a provider CLI that runs its own tools; such providers remain visible but unavailable here. Supporting them requires a provider-specific enforceable runtime boundary in Gosling, not automatic approval or a second agent loop in Trilium.

## Notes and permission decisions

Trilium's existing MCP tools run through Becca, CLS and the supported transaction layer. The integration never shares a database path with the agent. The turn policy filters tool advertisement and rechecks permission immediately before execution. With note access off there is no note MCP server and no current-note hint. With writes off only read tools are advertised. The scoped URL becomes invalid on turn completion, cancellation or revocation.

Additional enabled Gosling MCP extensions are selected by exact configuration identity. Trilium receives names for the picker; their configuration and credentials remain server-side in Gosling. The selected configurations preserve Gosling's tool allowlists. No installed extension is inherited automatically. The name `trilium` is reserved for the note endpoint.

ACP permission requests become transient stream events. Authenticated, CSRF-protected decision routes bind the random request identifier to the chat note. Only `allow_once` and `reject_once` are supported; unsupported decisions are denied explicitly. Abort and timeout resolve pending requests as cancelled. There is no persistent allow option. Tool errors, denied changes and applied changes remain distinct in chat history.

## Session and stream lifecycle

Each chat note maps to a separate Gosling session. `gosling-local/sessions.json` holds only host session identifiers, exact model identity, access signature, transcript hash and pending status. It is written atomically with private file permissions outside synchronized notes and options. No credentials or transcript contents are stored there.

A completed, unchanged chat resumes its session. A changed model, authority, visible history or uncertain turn requires explicit handoff into a new session using visible history as untrusted reference. New/load response evidence must match the requested route. Failure to create, configure or save a transition preserves the previous mapping; no prompt is sent when the initial mapping write fails. Gosling's global provider/model are never updated.

A pooled connection multiplexes session-addressed notifications and approvals. Concurrent turns in different chats remain isolated; a second turn in the same chat is refused, including across provider configuration IDs. Idle processes are reaped. Process exits evict the connection; a later completed chat uses `session/load`, with native-resume capability checked for provider-owned context. No prompt is replayed automatically.

Text, tool activity, approvals, session information, usage and terminal events stream in order. Only `end_turn` succeeds. Cancellation revokes the note endpoint, denies pending approvals and sends `session/cancel` for the affected session. EOF, process errors and interrupted turns retain partial results with an explicit incomplete error; duplicate terminal events cannot save a reply twice. Frontend authority resets when changing chats, and stale stream callbacks cannot update a newly selected chat.

## Validation boundary

The 2026-10-15 validation used synthetic Trilium profiles on loopback and a native Gosling build. Focused fixtures cover dynamic/custom/subscription/local inventories, exact identifiers, stale and expired-auth evidence, unavailable models, unsafe runtimes, session-scoped selection, failed transitions, disk failure, restart/load, concurrency, cancellation, notes revocation, once-only permissions and compatibility with existing providers.

An application restart also resumed a completed native Gosling session with exactly four saved user/assistant messages across two turns and no replay. The browser workflow demonstrated setup without keys, explicit model selection, streaming and saved replies, approved note reads, rejected and applied writes, cancellation during active inference, and no note tools after reload and revocation. A synthetic OpenAI-compatible loopback service supplied deterministic model behavior; this is transport/tool evidence, not a vendor inference certificate.

A direct live ACP call through `chatgpt_codex / gpt-6.1-sol` streamed the expected synthetic reply and completed with usage. Initial real inventory discovery returned 41 providers, 16 configured: 10 compatible with bounded execution and 6 provider-owned runtimes blocked. Three configured local routes reported no models, so local inference was not demonstrated. Listing is not proof of entitlement. Other configured providers and named external MCP services were not exercised live.

An initial macOS Keychain wait (`SecKeychainFindGenericPassword`) was resolved when the user approved Gosling's existing credential access. The full Trilium UI then discovered all 41 providers, explicitly selected `chatgpt_codex / gpt-6.1-sol` with low reasoning, streamed the expected synthetic reply and saved exactly two messages. After restarting Trilium, a follow-up resumed the same native Gosling session with low reasoning and note access off, returning the expected reply with exactly four saved messages and no replay or duplication. No keyring bypass, credential copying, model substitution or approval weakening was used. No existing installation or knowledge base was modified.

## Setup and rollback

See the User Guide's Gosling provider page for setup, capabilities, isolated launch and return to the existing installation. Use the companion Gosling binary; an older binary fails with upgrade guidance. Stopping the isolated preview and removing its environment overrides returns to the existing installation. Session mappings are host-local and may be backed up separately; they are not note migration data.