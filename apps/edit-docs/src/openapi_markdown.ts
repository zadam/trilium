/**
 * Renders an OpenAPI 3.x document as the Markdown body of a User Guide page. The page's title
 * comes from its note, so the output starts with the API's description rather than an H1.
 */

export interface OpenApiSpec {
    info: { title: string; description?: string };
    paths: Record<string, PathItem>;
    components?: {
        schemas?: Record<string, Schema>;
        parameters?: Record<string, Parameter>;
        requestBodies?: Record<string, RequestBody>;
        responses?: Record<string, Response>;
    };
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
}

type PathItem = { parameters?: (Parameter | Reference)[] } & Partial<Record<HttpMethod, Operation>>;

type HttpMethod = typeof HTTP_METHODS[number];

const HTTP_METHODS = [ "get", "put", "post", "delete", "options", "head", "patch", "trace" ] as const;

export function openApiToMarkdown(spec: OpenApiSpec): string {
    const blocks: string[] = [];
    if (spec.info.description) {
        blocks.push(spec.info.description.trim());
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
            blocks.push(...renderSchema(name, schema));
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
                blocks.push(propertyTable(resolved));
            }
        }
    }

    const responses = Object.entries(operation.responses ?? {});
    if (responses.length) {
        blocks.push("**Responses**", table(
            [ "Status", "Description", "Type" ],
            responses.map(([ status, response ]) => {
                const { description, content } = resolve<Response>(spec, response);
                const types = new Set(Object.values(content ?? {}).map(({ schema }) => typeOf(schema)));
                return [ code(status), description ?? "", [ ...types ].filter(Boolean).map(code).join(", ") ];
            })
        ));
    }

    return blocks;
}

function renderSchema(name: string, schema: Schema) {
    const blocks = [ `### ${code(name)}` ];
    if (schema.description) {
        blocks.push(schema.description.trim());
    }

    blocks.push(schema.properties ? propertyTable(schema) : `Type: ${code(typeOf(schema))}`);
    return blocks;
}

function propertyTable({ properties, required }: Schema) {
    const requiredProperties = new Set(required);
    return table(
        [ "Property", "Type", "Required", "Description" ],
        Object.entries(properties ?? {}).map(([ property, propertySchema ]) => [
            code(property),
            code(typeOf(propertySchema)),
            requiredProperties.has(property) ? "Yes" : "No",
            describe({ description: propertySchema.description, schema: propertySchema })
        ])
    );
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
