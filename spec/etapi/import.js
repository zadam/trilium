import {describeEtapi, postEtapi, postEtapiContent,getEtapiContent} from "../support/etapi";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describeEtapi("import", () => {
    it("import", async () => {
        const zipFileBuffer = fs.readFileSync(path.resolve(__dirname, 'test-export.zip'));

        const response = await postEtapiContent("notes/root/import", zipFileBuffer);
        expect(response.status).toEqual(201);

        const {note, branch} = await response.json();

        expect(note.title).toEqual("test-export");
        expect(branch.parentNoteId).toEqual("root");

        const content = await (await getEtapiContent(`notes/${note.noteId}/content`)).text();
        expect(content).toContain("test export content");
    });
});
