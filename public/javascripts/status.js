"use strict";

const status = (function() {
    const changesToPushCountEl = $("#changesToPushCount");

    async function checkStatus() {
        const resp = await $.ajax({
            url: baseApiUrl + 'status',
            type: 'POST',
            contentType: "application/json",
            data: JSON.stringify({
                treeLoadTime: noteTree.getTreeLoadTime(),
                currentNoteId: noteEditor.getCurrentNoteId(),
                currentNoteLoadTime: noteEditor.getCurrentNoteLoadTime()
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
            console.log("Reloading tree because of background changes");

            noteTree.reload();
        }

        if (resp.changedCurrentNote) {
            message('Reloading note because background change');

            noteEditor.reload();
        }

        changesToPushCountEl.html(resp.changesToPushCount);
    }

    setInterval(checkStatus, 5 * 1000);

    return {
        checkStatus
    };
})();