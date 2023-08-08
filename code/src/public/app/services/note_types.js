import server from "./server.js";
import froca from "./froca.js";

async function getNoteTypeItems(command) {
    const items = [
        { title: "Text", command: command, type: "text", uiIcon: "bx bx-note" },
        { title: "Code", command: command, type: "code", uiIcon: "bx bx-code" },
        { title: "Saved Search", command: command, type: "search", uiIcon: "bx bx-file-find" },
        { title: "Relation Map", command: command, type: "relationMap", uiIcon: "bx bx-map-alt" },
        { title: "Note Map", command: command, type: "noteMap", uiIcon: "bx bx-map-alt" },
        { title: "Render Note", command: command, type: "render", uiIcon: "bx bx-extension" },
        { title: "Book", command: command, type: "book", uiIcon: "bx bx-book" },
        { title: "Mermaid Diagram", command: command, type: "mermaid", uiIcon: "bx bx-selection" },
        { title: "Canvas", command: command, type: "canvas", uiIcon: "bx bx-pen" },
        { title: "Web View", command: command, type: "webView", uiIcon: "bx bx-globe-alt" },
    ];

    const templateNoteIds = await server.get("search-templates");
    const templateNotes = await froca.getNotes(templateNoteIds);

    if (templateNotes.length > 0) {
        items.push({ title: "----" });

        for (const templateNote of templateNotes) {
            items.push({
                title: templateNote.title,
                uiIcon: templateNote.getIcon(),
                command: command,
                type: templateNote.type,
                templateNoteId: templateNote.noteId
            });
        }
    }

    return items;
}

export default {
    getNoteTypeItems
}
