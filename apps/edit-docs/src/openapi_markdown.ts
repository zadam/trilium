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
}

interface Parameter {
    name: string;
    in: string;
    required?: boolean;
    description?: string;
    schema?: Schema;
}

interface MediaTypes {
    content?: Record<string, { schema?: Schema }>;
}

interface RequestBody extends MediaTypes {
    description?: string;
    required?: boolean;
}

interface Response extends MediaTypes {
    description?: string;
}

interface Operation {
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
    const blocks = [ `### \`${method.toUpperCase()} ${path}\`` ];
    for (const text of [ operation.summary, operation.description ]) {
        if (text) {
            blocks.push(text.trim());
        }
    }

    const security = operation.security ?? spec.security;
    if (security) {
        blocks.push(`**Authorization**: ${describeSecurity(security)}`);
    }

    const parameters = [ ...pathItem.parameters ?? [], ...operation.parameters ?? [] ]
        .map((parameter) => resolve<Parameter>(spec, parameter));
    if (parameters.length) {
        blocks.push("**Parameters**", table(
            [ "Name", "In", "Type", "Required", "Description" ],
            parameters.map((p) => [ code(p.name), p.in, code(typeOf(p.schema)), p.required ? "Yes" : "No", describe(p) ])
        ));
    }

    if (operation.requestBody) {
        const body = resolve<RequestBody>(spec, operation.requestBody);
        blocks.push(body.required ? "**Request body** (required)" : "**Request body**");
        if (body.description) {
            blocks.push(body.description.trim());
        }
        for (const [ mime, { schema } ] of Object.entries(body.content ?? {})) {
            blocks.push(`*   ${code(mime)}: ${code(typeOf(schema))}`);
            const resolved = schema && resolve(spec, schema);
            if (resolved?.properties) {
                blocks.push(propertyTable(spec, resolved));
            }
        }
    }

    const responses = Object.entries(operation.responses ?? {});
    if (responses.length) {
        blocks.push("**Responses**");
    }
    for (const [ status, response ] of responses) {
        const { description, content } = resolve<Response>(spec, response);

        // Content types of one response usually share a schema, which is then listed once.
        const schemas = new Map<string, Schema>();
        for (const { schema } of Object.values(content ?? {})) {
            if (schema) {
                schemas.set(typeOf(schema), schema);
            }
        }

        const types = [ ...schemas.keys() ].map(code).join(", ");
        const summary = [ code(status), description?.trim() ].filter(Boolean).join(": ");
        blocks.push(`*   ${summary}${types ? ` (${types})` : ""}`);
        for (const schema of schemas.values()) {
            const resolved = resolve(spec, schema);
            if (resolved.properties) {
                blocks.push(propertyTable(spec, resolved));
            }
        }
    }

    return blocks;
}

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
        [ "Property", "Type", "Required", "Description" ],
        Object.entries(properties ?? {}).map(([ property, propertySchema ]) => {
            const resolved = resolve(spec, propertySchema);
            return [
                code(property),
                code(typeOf(propertySchema)),
                requiredProperties.has(property) ? "Yes" : "No",
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

function code(text: string) {
    return text ? `\`${text}\`` : "";
}
