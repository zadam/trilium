function convertNoteToHtml(noteId, failedNotes) {
    $.ajax({
        url: baseApiUrl + 'notes/' + noteId,
        type: 'GET',
        async: false,
        success: function (note) {
            const noteNode = getNodeByKey(noteId);

            if (noteNode.data.is_clone) {
                // we shouldn't process notes twice
                return;
            }

            note.formatting = [];

            for (const link of note.links) {
                delete link.type;
            }

            $.ajax({
                url: baseApiUrl + 'notes/' + noteId,
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
}

function convertAll2Html() {
    const failedNotes = [];
    let counter = 1;

    for (const noteId of globalAllNoteIds) {
        console.log('Converting ' + counter + "/" + globalAllNoteIds.length);
        counter++;

        convertNoteToHtml(noteId, failedNotes);
    }

    console.log("Failed notes: ", failedNotes);
}