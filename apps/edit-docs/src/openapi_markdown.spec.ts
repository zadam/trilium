import { describe, expect, it } from "vitest";

import { openApiToMarkdown, type OpenApiSpec } from "./openapi_markdown.js";

const ENTITY_ID = { $ref: "#/components/schemas/EntityId" };

describe("openApiToMarkdown", () => {
    it("renders an operation with its parameters, request body and responses", () => {
        const spec: OpenApiSpec = {
            info: { title: "ETAPI", description: "External Trilium API" },
            security: [ { TokenAuth: [] }, { BasicAuth: [] } ],
            paths: {
                "/notes/{noteId}": {
                    parameters: [{ name: "noteId", in: "path", required: true, schema: ENTITY_ID }],
                    patch: {
                        operationId: "patchNote",
                        description: "Patch a note",
                        parameters: [{ $ref: "#/components/parameters/Force" }],
                        requestBody: {
                            required: true,
                            content: { "application/json": { schema: { $ref: "#/components/schemas/Note" } } }
                        },
                        responses: {
                            "200": {
                                description: "note updated",
                                content: { "application/json": { schema: { $ref: "#/components/schemas/Note" } } }
                            },
                            "default": { description: "unexpected error" }
                        }
                    }
                }
            },
            components: {
                parameters: {
                    Force: { name: "force", in: "query", schema: { type: "boolean" }, description: "skip checks" }
                },
                schemas: {
                    Note: { type: "object", required: [ "title" ], properties: { title: { type: "string" } } }
                },
                securitySchemes: {
                    TokenAuth: { type: "apiKey", in: "header", name: "Authorization" },
                    BasicAuth: { type: "http", scheme: "basic", description: "The token as the password." }
                }
            }
        };

        const markdown = openApiToMarkdown(spec);

        expect(markdown).toContain([
            "External Trilium API",
            "",
            "## Authentication",
            "",
            "### `TokenAuth`",
            "",
            "API key in the `Authorization` header.",
            "",
            "### `BasicAuth`",
            "",
            "HTTP `basic` authentication.",
            "",
            "The token as the password.",
            "",
            "## Endpoints"
        ].join("\n"));
        // Without a summary, the operation is named by its ID, with the route below. Operations
        // without a `security` of their own inherit the spec's.
        expect(markdown).toContain([
            "### `patchNote`",
            "",
            "`PATCH /notes/{noteId}`",
            "",
            "Patch a note",
            "",
            "**Authorization**: `TokenAuth` or `BasicAuth`"
        ].join("\n"));
        // Path-level parameters come first, then the operation's own, resolved through `$ref`.
        expect(markdown).toContain([
            "| Name | In | Type | Description |",
            "| --- | --- | --- | --- |",
            "| `noteId`<br>*required* | path | `EntityId` |  |",
            "| `force` | query | `boolean` | skip checks |"
        ].join("\n"));
        // The body's properties are listed in place, even when its schema is a reference, in a
        // column beside its sample, written as the Markdown export writes a multicolumn layout.
        const columns = [
            "<div class=\"trilium-multicolumn-layout\" data-trilium-column-ratios=\"1-1\">",
            "<div class=\"trilium-multicolumn-column\">",
            "",
            "| Property | Type | Description |",
            "| --- | --- | --- |",
            "| `title`<br>*required* | `string` |  |",
            "",
            "</div>",
            "<div class=\"trilium-multicolumn-column\">",
            "",
            "```json",
            "{",
            "    \"title\": \"string\"",
            "}",
            "```",
            "",
            "</div>",
            "</div>"
        ];
        expect(markdown).toContain([
            "**Request body** (required)",
            "",
            "*   `application/json`: `Note`",
            "",
            ...columns,
            "",
            "**Responses**"
        ].join("\n"));
        // A response with a body is followed by the properties of its schema, like the request body.
        expect(markdown).toContain([
            "**Responses**",
            "",
            "=== \"200: note updated\"",
            "",
            "    *   `application/json`: `Note`",
            "",
            ...columns.map((line) => line && `    ${line}`),
            "",
            "=== \"default: unexpected error\"",
            "",
            // A response without a body still gets a panel, so the tab does not look unfinished.
            "    No content."
        ].join("\n"));
    });

    it("groups operations by their first tag when the spec has tags", () => {
        const spec: OpenApiSpec = {
            info: { title: "Internal" },
            tags: [ { name: "Sync", description: "Synchronization between instances." }, { name: "Notes" } ],
            paths: {
                "/api/misc": { get: { tags: [ "Misc" ], responses: {} } },
                "/api/notes": { get: { tags: [ "Notes" ], summary: "List notes", operationId: "getNotes", responses: {} } },
                "/api/sync": { post: { tags: [ "Sync" ], security: [ { A: [], B: [] }, {} ], responses: {} } },
                "/api/login": { post: { tags: [ "Sync" ], security: [], responses: {} } },
                "/api/tree": { get: { tags: [ "Notes" ], responses: {} } }
            }
        };

        const markdown = openApiToMarkdown(spec);

        // Declared tags come first, in their declared order and with their description; the
        // others follow in order of appearance.
        expect(markdown).not.toContain("## Endpoints");
        expect(markdown).toContain("## Sync\n\nSynchronization between instances.\n\n### `POST /api/sync`");
        expect(markdown.indexOf("### `POST /api/login`")).toBeLessThan(markdown.indexOf("## Notes"));
        expect(markdown.indexOf("### `GET /api/tree`")).toBeLessThan(markdown.indexOf("## Misc"));
        expect(markdown.indexOf("## Misc")).toBeLessThan(markdown.indexOf("### `GET /api/misc`"));
        // A summary wins over the operation ID, which then follows the route; an operation with
        // neither is named by its route.
        expect(markdown).toContain("### List notes\n\n`GET /api/notes` · `getNotes`\n\n### `GET /api/tree`");

        // Schemes of one requirement are all needed; an empty requirement makes them optional.
        expect(markdown).toContain("**Authorization**: `A` and `B` or none");
        expect(markdown).toContain("### `POST /api/login`\n\n**Authorization**: none");
    });

    it("renders the schemas with their property types", () => {
        const spec: OpenApiSpec = {
            info: { title: "ETAPI" },
            paths: {},
            components: {
                schemas: {
                    EntityId: { type: "string", description: "Unique ID" },
                    Note: {
                        type: "object",
                        description: "A note",
                        required: [ "noteId" ],
                        properties: {
                            noteId: { ...ENTITY_ID, description: "The note's ID" },
                            parentNoteId: ENTITY_ID,
                            type: { type: "string", enum: [ "text", "code" ], description: "note type" },
                            attributes: { type: "array", items: { $ref: "#/components/schemas/Attribute" } },
                            dateCreated: { type: "string", format: "date-time", nullable: true },
                            parent: { oneOf: [ ENTITY_ID, { type: [ "string", "null" ] } ] },
                            content: { allOf: [ ENTITY_ID ], description: "Line one\nline | two" }
                        }
                    }
                }
            }
        };

        const markdown = openApiToMarkdown(spec);

        expect(markdown).toContain("## Schemas");
        expect(markdown).toContain("### `EntityId`\n\nUnique ID\n\nType: `string`");
        expect(markdown).toContain([
            "### `Note`",
            "",
            "A note",
            "",
            "| Property | Type | Description |",
            "| --- | --- | --- |",
            "| `noteId`<br>*required* | `EntityId` | The note's ID |",
            // Without a description of its own, a property takes the one of the schema it references.
            "| `parentNoteId` | `EntityId` | Unique ID |",
            "| `type` | `string` | note type. One of `text`, `code`. |",
            "| `attributes` | `array of Attribute` |  |",
            "| `dateCreated` | `string (date-time) \\| null` |  |",
            "| `parent` | `EntityId \\| string \\| null` |  |",
            "| `content` | `EntityId` | Line one line \\| two |"
        ].join("\n"));
    });

    it("renders JSON samples of request and response bodies", () => {
        const note = { $ref: "#/components/schemas/Note" };
        const spec: OpenApiSpec = {
            info: { title: "ETAPI" },
            paths: {
                "/notes": {
                    post: {
                        requestBody: { content: { "application/json": { schema: note } } },
                        responses: {
                            "201": { description: "created", content: { "application/json; charset=utf-8": { schema: note } } },
                            "400": {
                                description: "invalid",
                                content: { "application/json": { schema: note, example: { message: "bad" } } }
                            }
                        }
                    }
                },
                "/notes/{noteId}/content": {
                    put: {
                        requestBody: { content: { "text/plain": { schema: { type: "string" } } } },
                        responses: { "204": { description: "updated" } }
                    }
                }
            },
            components: {
                schemas: {
                    EntityId: { type: "string", example: "abc123" },
                    Note: {
                        type: "object",
                        properties: {
                            noteId: { $ref: "#/components/schemas/EntityId", readOnly: true },
                            title: { type: "string" },
                            type: { type: "string", enum: [ "text", "code" ] },
                            isExpanded: { type: "boolean", default: false },
                            dateCreated: { type: "string", format: "date-time" },
                            isProtected: { type: "boolean", readOnly: true },
                            childNoteIds: { type: "array", items: { $ref: "#/components/schemas/EntityId" } },
                            position: { type: "integer" },
                            password: { type: "string", writeOnly: true },
                            parent: note
                        }
                    }
                }
            }
        };

        const markdown = openApiToMarkdown(spec);
        // Response samples sit in the panel of their status's tab, indented by four spaces.
        const sample = (value: unknown, indent = "") => `\`\`\`json\n${JSON.stringify(value, null, 4)}\n\`\`\``
            .split("\n").map((line) => indent + line).join("\n");

        // A request leaves out read-only properties, a response write-only ones; a schema that
        // contains itself stops at an empty object.
        expect(markdown).toContain(sample({
            title: "string", type: "text", isExpanded: false, dateCreated: "2019-08-24T14:15:22Z",
            childNoteIds: [ "abc123" ], position: 0, password: "string", parent: {}
        }));
        expect(markdown).toContain(sample({
            noteId: "abc123", title: "string", type: "text", isExpanded: false, dateCreated: "2019-08-24T14:15:22Z",
            isProtected: true, childNoteIds: [ "abc123" ], position: 0, parent: {}
        }, "    "));
        // The example of a media type replaces the generated sample.
        expect(markdown).toContain(sample({ message: "bad" }, "    "));
        // Only JSON bodies get a sample.
        expect(markdown.match(/```json/g)).toHaveLength(3);
    });
});
