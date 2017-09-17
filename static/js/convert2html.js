function convertAll2Html() {
    const failedNotes = [];
    let counter = 1;

    for (const noteId of globalAllNoteIds) {
        console.log('Converting ' + counter + "/" + globalAllNoteIds.length);
        counter++;

        $.ajax({
            url: baseUrl + 'notes/' + noteId,
            type: 'GET',
            async: false,
            success: function (note) {
                note.detail.note_text = notecase2html(note);
                note.formatting = [];

                for (const link of note.links) {
                    delete link.type;
                }

                console.log(note.detail.note_text);

                $.ajax({
                    url: baseUrl + 'notes/' + noteId,
                    type: 'PUT',
                    data: JSON.stringify(note),
                    contentType: "application/json",
                    async: false,
                    success: function () {
                        console.log("Note " + noteId + " converted.")
                    },
                    error: function () {
                        console.log("Note " + noteId + " failed when writing");

                        failedNotes.push(noteId);
                    }
                });
            },
            error: function () {
                console.log("Note " + noteId + " failed when reading");

                failedNotes.push(noteId);
            }
        });

        break;
    }

    console.log("Failed notes: ", failedNotes);
}