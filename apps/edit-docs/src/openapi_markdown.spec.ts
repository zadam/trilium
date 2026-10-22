import { describe, expect, it } from "vitest";

import { openApiToMarkdown, type OpenApiSpec } from "./openapi_markdown.js";

const ENTITY_ID = { $ref: "#/components/schemas/EntityId" };

describe("openApiToMarkdown", () => {
    it("renders an operation with its parameters, request body and responses", () => {
        const spec: OpenApiSpec = {
            info: { title: "ETAPI", description: "External Trilium API" },
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
                }
            }
        };

        const markdown = openApiToMarkdown(spec);

        expect(markdown).toContain("External Trilium API");
        expect(markdown).toContain("## Endpoints");
        expect(markdown).toContain("### `PATCH /notes/{noteId}`\n\nPatch a note");
        // Path-level parameters come first, then the operation's own, resolved through `$ref`.
        expect(markdown).toContain([
            "| Name | In | Type | Required | Description |",
            "| --- | --- | --- | --- | --- |",
            "| `noteId` | path | `EntityId` | Yes |  |",
            "| `force` | query | `boolean` | No | skip checks |"
        ].join("\n"));
        expect(markdown).toContain("**Request body** (required)\n\n*   `application/json`: `Note`");
        expect(markdown).toContain([
            "| Status | Description | Type |",
            "| --- | --- | --- |",
            "| `200` | note updated | `Note` |",
            "| `default` | unexpected error |  |"
        ].join("\n"));
    });

    it("groups operations by their first tag when the spec has tags", () => {
        const spec: OpenApiSpec = {
            info: { title: "Internal" },
            paths: {
                "/api/notes": { get: { tags: [ "Notes" ], summary: "List notes", responses: {} } },
                "/api/sync": { post: { tags: [ "Sync" ], responses: {} } },
                "/api/tree": { get: { tags: [ "Notes" ], responses: {} } }
            }
        };

        const markdown = openApiToMarkdown(spec);

        expect(markdown).not.toContain("## Endpoints");
        expect(markdown.indexOf("## Notes")).toBeLessThan(markdown.indexOf("### `GET /api/tree`"));
        expect(markdown.indexOf("### `GET /api/tree`")).toBeLessThan(markdown.indexOf("## Sync"));
        expect(markdown).toContain("### `GET /api/notes`\n\nList notes");
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
            "| Property | Type | Required | Description |",
            "| --- | --- | --- | --- |",
            "| `noteId` | `EntityId` | Yes | The note's ID |",
            "| `type` | `string` | No | note type. One of `text`, `code`. |",
            "| `attributes` | `array of Attribute` | No |  |",
            "| `dateCreated` | `string (date-time) \\| null` | No |  |",
            "| `parent` | `EntityId \\| string \\| null` | No |  |",
            "| `content` | `EntityId` | No | Line one line \\| two |"
        ].join("\n"));
    });
});
