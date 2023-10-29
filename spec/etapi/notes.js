const {describeEtapi, postEtapi, getEtapi, getEtapiContent} = require("../support/etapi");

describeEtapi("notes", () => {
    it("create", async () => {
        const {note, branch} = await postEtapi('create-note', {
            parentNoteId: 'root',
            type: 'text',
            title: 'Hello World!',
            content: 'Content',
            prefix: 'Custom prefix'
        });

        expect(note.title).toEqual("Hello World!");
        expect(branch.parentNoteId).toEqual("root");
        expect(branch.prefix).toEqual("Custom prefix");

        const rNote = await getEtapi(`notes/${note.noteId}`);
        expect(rNote.title).toEqual("Hello World!");

        const rContent = await getEtapiContent(`notes/${note.noteId}/content`);
        expect(rContent).toEqual("Content");

        const rBranch = await getEtapi(`branches/${branch.branchId}`);
        expect(rBranch.parentNoteId).toEqual("root");
        expect(rBranch.prefix).toEqual("Custom prefix");
    });
});
