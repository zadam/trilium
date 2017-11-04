async function checkStatus() {
    const resp = await $.ajax({
        url: baseApiUrl + 'status',
        type: 'POST',
        contentType: "application/json",
        data: JSON.stringify({
            treeLoadTime: glob.treeLoadTime,
            currentNoteId: glob.currentNote ? glob.currentNote.detail.note_id : null,
            currentNoteDateModified: glob.currentNoteLoadTime
        }),
        statusCode: {
            401: () => {
                // if the user got logged out then we should display the page
                // here we do that by reloading which will force the redirect if the user is really logged out
                window.location.reload(true);
            },
            409: () => {
                // 409 means we need to migrate database, reload will take care of it
                window.location.reload(true);
            }
        }
    });

    if (resp.changedTree) {
        const treeResp = await loadTree();

        console.log("Reloading tree because of background changes");

        // this will also reload the note content
        await glob.tree.fancytree('getTree').reload(treeResp.notes);

        decryptTreeItems();
    }

    $("#changesToPushCount").html(resp.changesToPushCount);
}

setInterval(checkStatus, 5 * 1000);