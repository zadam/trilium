/**
 * Renders an OpenAPI 3.x document as the Markdown body of a User Guide page. The page's title
 * comes from its note, so the output starts with the API's description rather than an H1.
 */

export interface OpenApiSpec {
    info: { title: string; description?: string };
    paths: Record<string, PathItem>;
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

/** Groups operations by their first tag, in order of appearance; a spec without tags gets one group. */
function groupOperations(spec: OpenApiSpec) {
    const groups = new Map<string, OperationEntry[]>();
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

    return groups;
}

function renderOperation(spec: OpenApiSpec, { method, path, pathItem, operation }: OperationEntry) {
    // Named like Redocly does: by summary, else by operation ID, else by the route.
    const route = code(`${method.toUpperCase()} ${path}`);
    const title = operation.summary?.trim() || code(operation.operationId ?? "");
    const blocks = title ? [ `### ${title}`, route ] : [ `### ${route}` ];
    if (operation.description) {
        blocks.push(operation.description.trim());
    }

    const security = operation.security ?? spec.security;
    if (security) {
        blocks.push(`**Authorization**: ${describeSecurity(security)}`);
    }

    const parameters = [ ...pathItem.parameters ?? [], ...operation.parameters ?? [] ]
        .map((parameter) => resolve<Parameter>(spec, parameter));
    if (parameters.length) {
        blocks.push("**Parameters**", table(
            [ "Name", "In", "Type", "Description" ],
            parameters.map((p) => [ nameCell(p.name, p.required), p.in, code(typeOf(p.schema)), describe(p) ])
        ));
    }

    if (operation.requestBody) {
        const body = resolve<RequestBody>(spec, operation.requestBody);
        blocks.push(body.required ? "**Request body** (required)" : "**Request body**");
        if (body.description) {
            blocks.push(body.description.trim());
        }
        for (const [ mime, media ] of Object.entries(body.content ?? {})) {
            blocks.push(`*   ${mediaLine(mime, media)}`, ...renderBody(spec, mime, media, "request"));
        }
    }

    const responses = Object.entries(operation.responses ?? {});
    if (responses.length) {
        blocks.push("**Responses**");
    }
    for (const [ status, response ] of responses) {
        const { description, content } = resolve<Response>(spec, response);

        blocks.push(`*   ${[ code(status), description?.trim() ].filter(Boolean).join(": ")}`);
        for (const [ mime, media ] of Object.entries(content ?? {})) {
            blocks.push(`    *   ${mediaLine(mime, media)}`, ...renderBody(spec, mime, media, "response"));
        }
    }

    return blocks;
}

/** A body's content type, which is also its `Content-Type` header, and the type of its schema. */
function mediaLine(mime: string, { schema }: MediaType) {
    const type = typeOf(schema);
    return type ? `${code(mime)}: ${code(type)}` : code(mime);
}

type Direction = "request" | "response";

/** The property table of a body's schema, then a JSON sample of the body. */
function renderBody(spec: OpenApiSpec, mime: string, { schema, example, examples }: MediaType, direction: Direction) {
    const blocks: string[] = [];
    const resolved = schema && resolve(spec, schema);
    if (resolved?.properties) {
        blocks.push(propertyTable(spec, resolved));
    }

    if (mime.includes("json")) {
        const sample = example ?? Object.values(examples ?? {})[0]?.value ?? (schema && sampleOf(spec, schema, direction));
        if (sample !== undefined) {
            blocks.push(`\`\`\`json\n${JSON.stringify(sample, null, 4)}\n\`\`\``);
        }
    }

    return blocks;
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
