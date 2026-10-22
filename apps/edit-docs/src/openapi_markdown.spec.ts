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
        // Operations without a `security` of their own inherit the spec's.
        expect(markdown).toContain([
            "### `PATCH /notes/{noteId}`",
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
        // The body's properties are listed in place, even when its schema is a reference.
        expect(markdown).toContain([
            "**Request body** (required)",
            "",
            "*   `application/json`: `Note`",
            "",
            "| Property | Type | Description |",
            "| --- | --- | --- |",
            "| `title`<br>*required* | `string` |  |",
            "",
            "**Responses**"
        ].join("\n"));
        // A response with a body is followed by the properties of its schema, like the request body.
        expect(markdown).toContain([
            "**Responses**",
            "",
            "*   `200`: note updated (`Note`)",
            "",
            "| Property | Type | Description |",
            "| --- | --- | --- |",
            "| `title`<br>*required* | `string` |  |",
            "",
            "*   `default`: unexpected error"
        ].join("\n"));
    });

    it("groups operations by their first tag when the spec has tags", () => {
        const spec: OpenApiSpec = {
            info: { title: "Internal" },
            paths: {
                "/api/notes": { get: { tags: [ "Notes" ], summary: "List notes", responses: {} } },
                "/api/sync": { post: { tags: [ "Sync" ], security: [ { A: [], B: [] }, {} ], responses: {} } },
                "/api/login": { post: { tags: [ "Sync" ], security: [], responses: {} } },
                "/api/tree": { get: { tags: [ "Notes" ], responses: {} } }
            }
        };

        const markdown = openApiToMarkdown(spec);

        expect(markdown).not.toContain("## Endpoints");
        expect(markdown.indexOf("## Notes")).toBeLessThan(markdown.indexOf("### `GET /api/tree`"));
        expect(markdown.indexOf("### `GET /api/tree`")).toBeLessThan(markdown.indexOf("## Sync"));
        expect(markdown).toContain("### `GET /api/notes`\n\nList notes\n\n### `GET /api/tree`");

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
});
