/**
 * Renders an OpenAPI 3.x document as the Markdown body of a User Guide page. The page's title
 * comes from its note, so the output starts with the API's description rather than an H1.
 */
import { MULTICOLUMN_COLUMN_CLASS, MULTICOLUMN_LAYOUT_CLASS } from "../../../packages/commons/src/index.js";

export interface OpenApiSpec {
    info: { title: string; description?: string };
    paths: Record<string, PathItem>;
    /** Declares the order of the operation groups and describes them. */
    tags?: { name: string; description?: string }[];
    security?: SecurityRequirement[];
    components?: {
        schemas?: Record<string, Schema>;
        parameters?: Record<string, Parameter>;
        requestBodies?: Record<string, RequestBody>;
        responses?: Record<string, Response>;
        securitySchemes?: Record<string, SecurityScheme>;
    };
}

/** Scheme names mapped to their scopes; every scheme of one requirement is needed. */
type SecurityRequirement = Record<string, string[]>;

interface SecurityScheme {
    type: string;
    description?: string;
    /** For `apiKey`: where the key goes and under which name. */
    in?: string;
    name?: string;
    /** For `http`: the authorization scheme, e.g. `basic` or `bearer`. */
    scheme?: string;
}

interface Reference {
    $ref: string;
}

interface Schema {
    $ref?: string;
    type?: string | string[];
    format?: string;
    description?: string;
    enum?: unknown[];
    nullable?: boolean;
    items?: Schema;
    properties?: Record<string, Schema>;
    required?: string[];
    allOf?: Schema[];
    oneOf?: Schema[];
    anyOf?: Schema[];
    example?: unknown;
    default?: unknown;
    readOnly?: boolean;
    writeOnly?: boolean;
}

interface Parameter {
    name: string;
    in: string;
    required?: boolean;
    description?: string;
    schema?: Schema;
}

interface MediaType {
    schema?: Schema;
    example?: unknown;
    examples?: Record<string, { value?: unknown }>;
}

interface MediaTypes {
    content?: Record<string, MediaType>;
}

interface RequestBody extends MediaTypes {
    description?: string;
    required?: boolean;
}

interface Response extends MediaTypes {
    description?: string;
}

interface Operation {
    operationId?: string;
    tags?: string[];
    summary?: string;
    description?: string;
    parameters?: (Parameter | Reference)[];
    requestBody?: RequestBody | Reference;
    responses?: Record<string, Response | Reference>;
    security?: SecurityRequirement[];
}

type PathItem = { parameters?: (Parameter | Reference)[] } & Partial<Record<HttpMethod, Operation>>;

type HttpMethod = typeof HTTP_METHODS[number];

const HTTP_METHODS = [ "get", "put", "post", "delete", "options", "head", "patch", "trace" ] as const;

/** The places a parameter can go, in the order their tables appear. */
const PARAMETER_LOCATIONS = [
    [ "path", "Path parameters" ],
    [ "query", "Query parameters" ],
    [ "header", "Header parameters" ],
    [ "cookie", "Cookie parameters" ]
] as const;

export function openApiToMarkdown(spec: OpenApiSpec): string {
    const blocks: string[] = [];
    if (spec.info.description) {
        blocks.push(spec.info.description.trim());
    }

    const securitySchemes = Object.entries(spec.components?.securitySchemes ?? {});
    if (securitySchemes.length) {
        blocks.push("## Authentication");
        for (const [ name, scheme ] of securitySchemes) {
            blocks.push(`### ${code(name)}`, describeSecurityScheme(scheme));
            if (scheme.description) {
                blocks.push(scheme.description.trim());
            }
        }
    }

    for (const [ group, operations ] of groupOperations(spec)) {
        blocks.push(`## ${group}`);
        const description = spec.tags?.find((tag) => tag.name === group)?.description;
        if (description) {
            blocks.push(description.trim());
        }
        for (const operation of operations) {
            blocks.push(...renderOperation(spec, operation));
        }
    }

    const schemas = Object.entries(spec.components?.schemas ?? {});
    if (schemas.length) {
        blocks.push("## Schemas");
        for (const [ name, schema ] of schemas) {
            blocks.push(...renderSchema(spec, name, schema));
        }
    }

    return blocks.join("\n\n");
}

interface OperationEntry {
    method: HttpMethod;
    path: string;
    pathItem: PathItem;
    operation: Operation;
}

/**
 * Groups operations by their first tag: the tags the spec declares first, in that order, then the
 * others in order of appearance. Operations without a tag share one group.
 */
function groupOperations(spec: OpenApiSpec) {
    const groups = new Map<string, OperationEntry[]>((spec.tags ?? []).map((tag) => [ tag.name, [] ]));
    for (const [ path, pathItem ] of Object.entries(spec.paths)) {
        for (const method of HTTP_METHODS) {
            const operation = pathItem[method];
            if (!operation) {
                continue;
            }

            const group = operation.tags?.[0] ?? "Endpoints";
            const entries = groups.get(group) ?? [];
            entries.push({ method, path, pathItem, operation });
            groups.set(group, entries);
        }
    }

    return [ ...groups ].filter(([ , entries ]) => entries.length);
}

function renderOperation(spec: OpenApiSpec, { method, path, pathItem, operation }: OperationEntry) {
    // Named like Redocly does: by summary, else by operation ID, else by the route. The route line
    // keeps the operation ID in sight when the summary takes the heading.
    const route = code(`${method.toUpperCase()} ${path}`);
    const id = code(operation.operationId ?? "");
    const summary = operation.summary?.trim();
    const blocks = summary
        ? [ `### ${summary}`, id ? `${route} · ${id}` : route ]
        : id ? [ `### ${id}`, route ] : [ `### ${route}` ];
    if (operation.description) {
        blocks.push(operation.description.trim());
    }

    const security = operation.security ?? spec.security;
    if (security) {
        blocks.push(`**Authorization**: ${describeSecurity(security)}`);
    }

    const parameters = [ ...pathItem.parameters ?? [], ...operation.parameters ?? [] ]
        .map((parameter) => resolve<Parameter>(spec, parameter));
    for (const [ location, label ] of PARAMETER_LOCATIONS) {
        const located = parameters.filter((p) => p.in === location);
        if (located.length) {
            blocks.push(`**${label}**`, table(
                [ "Name", "Type", "Description" ],
                located.map((p) => [ nameCell(p.name, p.required), code(typeOf(p.schema)), describe(p) ])
            ));
        }
    }

    if (operation.requestBody) {
        const body = resolve<RequestBody>(spec, operation.requestBody);
        blocks.push(body.required ? "**Request body** (required)" : "**Request body**");
        if (body.description) {
            blocks.push(body.description.trim());
        }
        blocks.push(...renderContent(spec, body.content ?? {}, "request"));
    }

    const responses = Object.entries(operation.responses ?? {});
    if (responses.length) {
        blocks.push("**Responses**");
    }
    // One tab per status; consecutive tabs form a single tab block.
    for (const [ status, response ] of responses) {
        const { description, content } = resolve<Response>(spec, response);

        const panel = renderContent(spec, content ?? {}, "response");
        if (!panel.length) {
            panel.push("No content.");
        }

        // A tab's title is one line.
        const title = [ status, description?.replace(/\s+/g, " ").trim() ].filter(Boolean).join(": ");
        blocks.push(`=== "${title}"`, ...panel.map(indent));
    }

    return blocks;
}

/** Indents a block into the panel of a tab, which holds the lines indented by four spaces. */
function indent(block: string) {
    return block.split("\n").map((line) => line ? `    ${line}` : line).join("\n");
}

/** A body's content type, which is also its `Content-Type` header, and the type of its schema. */
function mediaLine(mime: string, { schema }: MediaType) {
    const type = typeOf(schema);
    return type ? `${code(mime)}: ${code(type)}` : code(mime);
}

type Direction = "request" | "response";

/**
 * The content types of a body, each with its table and sample. When there are several and one of
 * them has something to show, each content type becomes a tab; otherwise they stay a list.
 */
function renderContent(spec: OpenApiSpec, content: Record<string, MediaType>, direction: Direction) {
    const bodies = Object.entries(content)
        .map(([ mime, media ]) => ({ line: mediaLine(mime, media), body: renderBody(spec, mime, media, direction) }));

    if (bodies.length > 1 && bodies.some(({ body }) => body.length)) {
        return bodies.flatMap(({ line, body }) => [ `=== "${line}"`, ...body.map(indent) ]);
    }
    return bodies.flatMap(({ line, body }) => [ `*   ${line}`, ...body ]);
}

/**
 * The property table of a body's schema and a sample of the body, side by side when both exist.
 * The sample is the body's own example in any format, else one generated for a JSON body.
 */
function renderBody(spec: OpenApiSpec, mime: string, { schema, example, examples }: MediaType, direction: Direction) {
    const blocks: string[] = [];
    const resolved = schema && resolve(spec, schema);
    if (resolved?.properties) {
        blocks.push(propertyTable(spec, resolved));
    }

    const isJson = mime.includes("json");
    const sample = example ?? Object.values(examples ?? {})[0]?.value
        ?? (isJson && schema ? sampleOf(spec, schema, direction) : undefined);
    if (sample !== undefined) {
        const text = typeof sample === "string" && !isJson ? sample.trimEnd() : JSON.stringify(sample, null, 4);
        blocks.push(`\`\`\`${isJson ? "json" : "plaintext"}\n${text}\n\`\`\``);
    }

    return blocks.length > 1 ? [ columns(blocks) ] : blocks;
}

/** A multicolumn layout of equal columns, in the shape the Markdown export writes it. */
function columns(blocks: string[]) {
    const layout = `<div class="${MULTICOLUMN_LAYOUT_CLASS}" data-trilium-column-ratios="${blocks.map(() => 1).join("-")}">`;
    const content = blocks.map((block) => `<div class="${MULTICOLUMN_COLUMN_CLASS}">\n\n${block}\n\n</div>`);
    return [ layout, ...content, "</div>" ].join("\n");
}

/**
 * A value matching the schema, built from its examples where it has them. A request leaves out
 * read-only properties and a response write-only ones; a schema met again inside itself
 * becomes `{}`.
 */
function sampleOf(spec: OpenApiSpec, schema: Schema, direction: Direction, seen: ReadonlySet<string> = new Set()): unknown {
    if (schema.example !== undefined) {
        return schema.example;
    }
    if (schema.$ref) {
        return seen.has(schema.$ref)
            ? {}
            : sampleOf(spec, resolve(spec, schema), direction, new Set([ ...seen, schema.$ref ]));
    }
    if (schema.default !== undefined) {
        return schema.default;
    }
    if (schema.enum?.length) {
        return schema.enum[0];
    }
    if (schema.allOf) {
        return Object.assign({}, ...schema.allOf.map((part) => sampleOf(spec, part, direction, seen)));
    }
    const variant = schema.oneOf?.[0] ?? schema.anyOf?.[0];
    if (variant) {
        return sampleOf(spec, variant, direction, seen);
    }

    const type = [ schema.type ].flat().find((t) => t !== "null") ?? (schema.properties ? "object" : undefined);
    switch (type) {
        case "object": {
            const sample: Record<string, unknown> = {};
            for (const [ property, propertySchema ] of Object.entries(schema.properties ?? {})) {
                const resolved = resolve(spec, propertySchema);
                const hidden = direction === "request"
                    ? propertySchema.readOnly ?? resolved.readOnly
                    : propertySchema.writeOnly ?? resolved.writeOnly;
                if (!hidden) {
                    sample[property] = sampleOf(spec, propertySchema, direction, seen);
                }
            }
            return sample;
        }
        case "array":
            return schema.items ? [ sampleOf(spec, schema.items, direction, seen) ] : [];
        case "string":
            return STRING_SAMPLES[schema.format ?? ""] ?? "string";
        case "integer":
        case "number":
            return 0;
        case "boolean":
            return true;
        default:
            return null;
    }
}

/** Placeholders for strings of a known format, the ones Redocly uses. */
const STRING_SAMPLES: Record<string, string> = {
    "date-time": "2019-08-24T14:15:22Z",
    "date": "2019-08-24"
};

function renderSchema(spec: OpenApiSpec, name: string, schema: Schema) {
    const blocks = [ `### ${code(name)}` ];
    if (schema.description) {
        blocks.push(schema.description.trim());
    }

    blocks.push(schema.properties ? propertyTable(spec, schema) : `Type: ${code(typeOf(schema))}`);
    return blocks;
}

function propertyTable(spec: OpenApiSpec, { properties, required }: Schema) {
    const requiredProperties = new Set(required);
    return table(
        [ "Property", "Type", "Description" ],
        Object.entries(properties ?? {}).map(([ property, propertySchema ]) => {
            const resolved = resolve(spec, propertySchema);
            return [
                nameCell(property, requiredProperties.has(property)),
                code(typeOf(propertySchema)),
                describe({ description: propertySchema.description ?? resolved.description, schema: resolved })
            ];
        })
    );
}

function describeSecurityScheme({ type, in: location, name, scheme }: SecurityScheme) {
    if (type === "apiKey" && location && name) {
        const where = location === "query" ? "query parameter" : location;
        return `API key in the ${code(name)} ${where}.`;
    }
    if (type === "http" && scheme) {
        return `HTTP ${code(scheme)} authentication.`;
    }
    return `Type: ${code(type)}.`;
}

/** Requirements are alternatives; an empty one (or none at all) lets the call go unauthenticated. */
function describeSecurity(requirements: SecurityRequirement[]) {
    if (!requirements.length) {
        return "none";
    }

    return requirements
        .map((requirement) => Object.keys(requirement).map(code).join(" and ") || "none")
        .join(" or ");
}

/** The type of a schema as one line, naming referenced schemas instead of expanding them. */
function typeOf(schema: Schema | undefined): string {
    if (!schema) {
        return "";
    }

    let type: string;
    if (schema.$ref) {
        type = refName(schema.$ref);
    } else if (schema.allOf) {
        type = schema.allOf.map(typeOf).join(" & ");
    } else if (schema.oneOf ?? schema.anyOf) {
        type = (schema.oneOf ?? schema.anyOf ?? []).map(typeOf).join(" | ");
    } else if (schema.type === "array") {
        type = `array of ${typeOf(schema.items)}`;
    } else if (schema.type) {
        type = [ schema.type ].flat().join(" | ");
        if (schema.format) {
            type += ` (${schema.format})`;
        }
    } else {
        type = schema.properties ? "object" : "any";
    }

    return schema.nullable ? `${type} | null` : type;
}

function describe({ description, schema }: { description?: string; schema?: Schema }) {
    if (!schema?.enum) {
        return description ?? "";
    }

    const values = `One of ${schema.enum.map((value) => code(String(value))).join(", ")}.`;
    return description ? `${description.trim().replace(/(?<![.!?])$/, ".")} ${values}` : values;
}

function resolve<T extends object>(spec: OpenApiSpec, value: T | Reference): T {
    if (!isReference(value)) {
        return value;
    }

    // "#/components/parameters/Force" → spec.components.parameters.Force
    let target: unknown = spec;
    for (const segment of value.$ref.replace(/^#\//, "").split("/")) {
        target = (target as Record<string, unknown> | undefined)?.[segment];
    }
    if (!target) {
        throw new Error(`Cannot resolve ${value.$ref}`);
    }
    return target as T;
}

function isReference(value: object): value is Reference {
    return "$ref" in value;
}

function refName(ref: string) {
    return ref.slice(ref.lastIndexOf("/") + 1);
}

function table(headers: string[], rows: string[][]) {
    return [ headers, headers.map(() => "---"), ...rows ]
        .map((cells) => `| ${cells.map(cell).join(" | ")} |`)
        .join("\n");
}

/** A table cell holds one line, and a pipe would end it early, even inside a code span. */
function cell(text: string) {
    return text.replace(/\s*\n\s*/g, " ").replaceAll("|", "\\|").trim();
}

/** The name cell of a parameter or property, marking it below the name when it is required. */
function nameCell(text: string, required?: boolean) {
    return required ? `${code(text)}<br>*required*` : code(text);
}

function code(text: string) {
    return text ? `\`${text}\`` : "";
}
