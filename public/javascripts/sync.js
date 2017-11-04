function syncNow() {
    $.ajax({
        url: baseApiUrl + 'sync/now',
        type: 'POST',
        success: result => {
            if (result.success) {
                checkStatus();

                message("Sync triggered.");
            }
            else {
                error("Sync failed");
            }
        },
        error: () => error("Sync failed")
    });
}