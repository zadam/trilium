/**
 * Renders the declarations of a TypeScript module, as TypeDoc reads them, as the Markdown body of
 * a User Guide page. The page's title comes from its note, so the output starts with the module's
 * `@packageDocumentation` comment rather than an H1.
 */
import type { JSONOutput } from "typedoc";

type Project = JSONOutput.ProjectReflection;
type Declaration = JSONOutput.DeclarationReflection;
type Signature = JSONOutput.SignatureReflection;
type SomeType = JSONOutput.SomeType;
type Comment = JSONOutput.Comment;

/** Runs TypeDoc on one entry point and returns its model, as `typedoc --json` writes it. */
export async function runTypeDoc(entryPoint: string, tsconfig: string): Promise<Project> {
    const { Application, normalizePath } = await import("typedoc");
    const app = await Application.bootstrap({
        // Entry points are globs, which take `/` as the only separator.
        entryPoints: [ entryPoint.replaceAll("\\", "/") ],
        tsconfig,
        skipErrorChecking: true,
        sort: [ "source-order" ],
        excludePrivate: true,
        logLevel: "Error"
    });
    const project = await app.convert();
    if (!project || app.logger.hasErrors()) {
        throw new Error(`TypeDoc could not convert ${entryPoint}.`);
    }

    return app.serializer.projectToObject(project, normalizePath(process.cwd()));
}

/**
 * Renders `root` first, then the declarations it reaches in order of first reference, then the
 * remaining exports in source order. Without `root`, the exports follow in source order.
 */
export function typeDocToMarkdown(project: Project, root?: string): string {
    const blocks: string[] = [];
    if (project.comment) {
        blocks.push(renderComment(project.comment));
    }

    for (const declaration of orderDeclarations(project.children ?? [], root)) {
        blocks.push(...renderDeclaration(declaration));
    }

    return blocks.filter(Boolean).join("\n\n");
}

/** The `ReflectionKind` values this module renders. */
const KIND = {
    interface: 256,
    typeAlias: 2097152,
    property: 1024,
    method: 2048,
    accessor: 262144
};

function orderDeclarations(declarations: Declaration[], root: string | undefined) {
    const byName = new Map(declarations.map((declaration) => [ declaration.name, declaration ]));
    const ordered = new Set<Declaration>();
    const queue = root && byName.has(root) ? [ root ] : [];

    while (queue.length) {
        const declaration = byName.get(queue.shift() ?? "");
        if (!declaration || ordered.has(declaration)) {
            continue;
        }

        ordered.add(declaration);
        queue.push(...referencedNames(declaration).filter((name) => byName.has(name)));
    }

    for (const declaration of declarations) {
        ordered.add(declaration);
    }

    return [ ...ordered ];
}

/** The names of the types a declaration refers to, in the order they appear in it. */
function referencedNames(declaration: Declaration) {
    const names: string[] = [];
    const visit = (value: unknown) => {
        if (Array.isArray(value)) {
            for (const item of value) {
                visit(item);
            }
        } else if (value && typeof value === "object") {
            const node = value as Record<string, unknown>;
            if (node.type === "reference" && typeof node.name === "string") {
                names.push(node.name);
            }
            for (const [ key, child ] of Object.entries(node)) {
                if (key !== "comment") {
                    visit(child);
                }
            }
        }
    };
    visit(declaration);
    return names;
}

function renderDeclaration(declaration: Declaration) {
    const blocks = [ `## ${code(declaration.name)}` ];
    if (declaration.comment) {
        blocks.push(renderComment(declaration.comment));
    }

    if (declaration.kind === KIND.typeAlias) {
        blocks.push(fence(`type ${declaration.name} = ${typeToString(declaration.type)}`));
        return blocks;
    }

    const members = declaration.children ?? [];
    const properties = members.filter((member) => member.kind === KIND.property || member.kind === KIND.accessor);
    const methods = members.filter((member) => member.kind === KIND.method);

    if (properties.length) {
        blocks.push(table([ "Property", "Description" ], properties.map((property) => [
            property.flags.isOptional ? `${code(property.name)}<br>*optional*` : code(property.name),
            details(typeToString(property.type ?? property.getSignature?.type), property.comment)
        ])));
    }

    for (const method of methods) {
        blocks.push(...renderMethod(method));
    }

    return blocks;
}

function renderMethod(method: Declaration) {
    const signatures = method.signatures ?? [];
    const blocks = [ `### ${code(method.name)}`, fence(signatures.map(signatureToString).join("\n")) ];

    // Overloads share one entry, described by the first signature that has a comment.
    const signature = signatures.find((candidate) => candidate.comment) ?? signatures[0];
    if (!signature) {
        return blocks;
    }

    if (signature.comment) {
        blocks.push(renderComment(signature.comment));
    }

    const parameters = signature.parameters ?? [];
    if (parameters.length) {
        blocks.push(table([ "Parameter", "Description" ], parameters.map((parameter) => [
            parameter.flags.isOptional ? `${code(parameter.name)}<br>*optional*` : code(parameter.name),
            details(typeToString(parameter.type), parameter.comment)
        ])));
    }

    const returnType = typeToString(signature.type);
    if (returnType !== "void") {
        const description = blockTag(signature.comment, "@returns");
        blocks.push(`**Returns** ${code(returnType)}${description ? `: ${description}` : ""}`);
    }

    return blocks;
}

/** A comment's summary, followed by a warning when it carries `@deprecated`. */
function renderComment(comment: Comment) {
    const blocks = [ partsToMarkdown(comment.summary) ];
    const deprecated = comment.blockTags?.find((tag) => tag.tag === "@deprecated");
    if (deprecated) {
        const reason = partsToMarkdown(deprecated.content);
        blocks.push(`> [!WARNING]\n> Deprecated.${reason ? ` ${reason.replace(/\n/g, "\n> ")}` : ""}`);
    }

    return blocks.filter(Boolean).join("\n\n");
}

function blockTag(comment: Comment | undefined, tag: string) {
    const content = comment?.blockTags?.find((candidate) => candidate.tag === tag)?.content;
    return content ? partsToMarkdown(content) : "";
}

/** Comment text as Markdown; a `{@link}` becomes its target's name as code. */
function partsToMarkdown(parts: JSONOutput.CommentDisplayPart[]) {
    return parts.map((part) => part.kind === "inline-tag" ? code(part.text) : part.text).join("").trim();
}

/** A table cell holding a type, with the description on the line below. */
function details(type: string, comment: Comment | undefined) {
    const description = comment ? partsToMarkdown(comment.summary).replace(/\s*\n\s*/g, " ") : "";
    return [ code(type), description ].filter(Boolean).join("<br>");
}

function signatureToString(signature: Signature) {
    return `${signature.name}${parametersToString(signature)}: ${typeToString(signature.type)}`;
}

function parametersToString(signature: Signature) {
    const parameters = (signature.parameters ?? []).map((parameter) => {
        const rest = parameter.flags.isRest ? "..." : "";
        const optional = parameter.flags.isOptional ? "?" : "";
        return `${rest}${parameter.name}${optional}: ${typeToString(parameter.type)}`;
    });
    return `(${parameters.join(", ")})`;
}

/** A type as TypeScript writes it. */
function typeToString(type: SomeType | undefined): string {
    if (!type) {
        return "";
    }

    switch (type.type) {
        case "intrinsic":
            return type.name;
        case "reference": {
            const args = type.typeArguments?.map(typeToString).join(", ");
            return args ? `${type.name}<${args}>` : type.name;
        }
        case "literal":
            return type.value === null ? "null"
                : typeof type.value === "object" ? `${type.value.negative ? "-" : ""}${type.value.value}n`
                    : JSON.stringify(type.value);
        case "array":
            return `${wrap(type.elementType)}[]`;
        case "union":
            return type.types.map(typeToString).join(" | ");
        case "intersection":
            return type.types.map(wrap).join(" & ");
        case "tuple":
            return `[${(type.elements ?? []).map(typeToString).join(", ")}]`;
        case "namedTupleMember":
            return `${type.name}${type.isOptional ? "?" : ""}: ${typeToString(type.element)}`;
        case "optional":
            return `${typeToString(type.elementType)}?`;
        case "rest":
            return `...${typeToString(type.elementType)}`;
        case "typeOperator":
            return `${type.operator} ${wrap(type.target)}`;
        case "query":
            return `typeof ${typeToString(type.queryType)}`;
        case "indexedAccess":
            return `${wrap(type.objectType)}[${typeToString(type.indexType)}]`;
        case "predicate":
            return `${type.asserts ? "asserts " : ""}${type.name}${type.targetType ? ` is ${typeToString(type.targetType)}` : ""}`;
        case "reflection":
            return reflectionToString(type.declaration);
        default:
            return "name" in type && typeof type.name === "string" ? type.name : type.type;
    }
}

/** An inline type: a function type, or an object type literal. */
function reflectionToString(declaration: Declaration) {
    const signature = declaration.signatures?.[0];
    if (signature) {
        return `${parametersToString(signature)} => ${typeToString(signature.type)}`;
    }

    const members = (declaration.children ?? []).map((member) => {
        const optional = member.flags.isOptional ? "?" : "";
        const memberSignature = member.signatures?.[0];
        return memberSignature
            ? `${member.name}${optional}${parametersToString(memberSignature)}: ${typeToString(memberSignature.type)}`
            : `${member.name}${optional}: ${typeToString(member.type)}`;
    });
    const index = declaration.indexSignatures?.[0];
    if (index) {
        const [ key ] = index.parameters ?? [];
        members.push(`[${key?.name ?? "key"}: ${typeToString(key?.type)}]: ${typeToString(index.type)}`);
    }

    return members.length ? `{ ${members.join("; ")} }` : "{}";
}

/** A type as an operand of `[]`, `&` or a type operator, in parentheses when it needs them. */
function wrap(type: SomeType | undefined) {
    const text = typeToString(type);
    const needsParentheses = type?.type === "union" || type?.type === "intersection"
        || (type?.type === "reflection" && !!type.declaration.signatures?.length);
    return needsParentheses ? `(${text})` : text;
}

function fence(text: string) {
    return `\`\`\`ts\n${text}\n\`\`\``;
}

function table(headers: string[], rows: string[][]) {
    const line = (cells: string[]) => `| ${cells.map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`;
    return [ line(headers), `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map(line) ].join("\n");
}

function code(text: string) {
    return text ? `\`${text}\`` : "";
}
