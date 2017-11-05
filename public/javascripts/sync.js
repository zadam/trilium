"use strict";

function syncNow() {
    $.ajax({
        url: baseApiUrl + 'sync/now',
        type: 'POST',
        success: result => {
            if (result.success) {
                status.checkStatus();

                message("Sync finished successfully.");
            }
            else {
                if (result.message.length > 50) {
                    result.message = result.message.substr(0, 50);
                }

                error("Sync failed: " + result.message);
            }
        },
        error: () => error("Sync failed for unknown reason.")
    });
}