"use strict";

function syncNow() {
    $.ajax({
        url: baseApiUrl + 'sync/now',
        type: 'POST',
        success: result => {
            if (result.success) {
                showMessage("Sync finished successfully.");
            }
            else {
                if (result.message.length > 50) {
                    result.message = result.message.substr(0, 50);
                }

                showError("Sync failed: " + result.message);
            }
        },
        error: () => showError("Sync failed for unknown reason.")
    });
}