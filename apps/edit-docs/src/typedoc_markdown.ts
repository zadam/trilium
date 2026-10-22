/**
 * Renders the declarations of a TypeScript module, as TypeDoc reads them, as the Markdown body of
 * a User Guide page. The page's title comes from its note, so the output starts with the module's
 * `@packageDocumentation` comment rather than an H1.
 */
import { renderToHtml } from "@triliumnext/commons/src/lib/markdown_renderer.js";
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

    const members = (declaration.children ?? []).filter((member) =>
        member.kind === KIND.property || member.kind === KIND.accessor || member.kind === KIND.method);
    if (!members.length) {
        return blocks;
    }

    // Properties alone fit a Markdown table; a method's cell holds blocks, which only HTML can.
    if (!members.some((member) => member.kind === KIND.method)) {
        blocks.push(table([ "Property", "Description" ], members.map((property) => [
            property.flags.isOptional ? `${code(property.name)}<br>*optional*` : code(property.name),
            propertyDetails(property)
        ])));
        return blocks;
    }

    blocks.push(htmlTable([ "Member", "Description" ], members.map((member) => [
        `<code>${escapeHtml(member.name)}</code>${member.flags.isOptional ? "<br><em>optional</em>" : ""}`,
        markdownToHtml(member.kind === KIND.method ? methodDetails(member) : propertyDetails(member))
    ])));
    return blocks;
}

function propertyDetails(property: Declaration) {
    return details(typeToString(property.type ?? property.getSignature?.type), property.comment);
}

/**
 * A method's signature and description, then its parameters and its return value when a comment
 * describes them; otherwise the signature already says all they would.
 */
function methodDetails(method: Declaration) {
    const signatures = method.signatures ?? [];
    const blocks = [ fence(signatures.map(signatureToString).join("\n")) ];

    // Overloads share one entry, described by the first signature that has a comment.
    const signature = signatures.find((candidate) => candidate.comment) ?? signatures[0];
    if (!signature) {
        return blocks.join("\n\n");
    }

    if (signature.comment) {
        blocks.push(renderComment(signature.comment));
    }

    const parameters = signature.parameters ?? [];
    if (parameters.some((parameter) => parameter.comment)) {
        blocks.push(table([ "Parameter", "Description" ], parameters.map((parameter) => [
            parameter.flags.isOptional ? `${code(parameter.name)}<br>*optional*` : code(parameter.name),
            details(typeToString(parameter.type), parameter.comment)
        ])));
    }

    const returns = blockTag(signature.comment, "@returns");
    if (returns) {
        blocks.push(`**Returns** ${code(typeToString(signature.type))}: ${returns}`);
    }

    return blocks.filter(Boolean).join("\n\n");
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

/**
 * A table as the Markdown export writes one it keeps as HTML: a structural tag per line and
 * each cell's content on one line, so the page comes back from an import and export unchanged.
 */
function htmlTable(headers: string[], rows: string[][]) {
    const tableRow = (tag: string, cells: string[]) => [
        "        <tr>",
        ...cells.map((cell) => `            <${tag}>${cell}</${tag}>`),
        "        </tr>"
    ];
    return [
        "<table>",
        "    <thead>",
        ...tableRow("th", headers),
        "    </thead>",
        "    <tbody>",
        ...rows.flatMap((cells) => tableRow("td", cells)),
        "    </tbody>",
        "</table>"
    ].join("\n");
}

/**
 * Markdown rendered as a table cell takes it, in the form the export writes the cell: the import's
 * renderer, on one line outside `<pre>`, with quotes in text unescaped. A blank line in a `<pre>`
 * becomes `&#10;`, since a blank line would end the HTML block.
 */
function markdownToHtml(markdown: string) {
    const html = renderToHtml(markdown, "", { sanitize: (dirtyHtml) => dirtyHtml, demoteH1: false })
        .trim()
        .replace(/>\n+</g, "><")
        .replace(/>([^<]*)</g, (_, text: string) => `>${text.replaceAll("&#39;", "'").replaceAll("&quot;", "\"")}<`);

    return html.split(/(<pre[\s\S]*?<\/pre>)/)
        .map((part) => part.startsWith("<pre")
            ? part.replace(/\n(?=[ \t]*(?:\n|$))/g, "&#10;")
            : part.replace(/\s*\n\s*/g, " "))
        .join("");
}

function escapeHtml(text: string) {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function code(text: string) {
    return text ? `\`${text}\`` : "";
}
