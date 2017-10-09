function convertNoteToHtml(noteId, failedNotes) {
    $.ajax({
        url: baseApiUrl + 'notes/' + noteId,
        type: 'GET',
        async: false,
        success: note => {
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
                success: () => {
                    console.log("Note " + noteId + " converted.")
                },
                error: () => {
                    console.log("Note " + noteId + " failed when writing");

                    failedNotes.push(noteId);
                }
            });
        },
        error: () => {
            console.log("Note " + noteId + " failed when reading");

            failedNotes.push(noteId);
        }
    });
}