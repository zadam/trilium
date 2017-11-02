function syncNow() {
    $.ajax({
        url: baseApiUrl + 'sync/now',
        type: 'POST',
        success: result => {
            if (result.success) {
                checkStatus();

                message("Sync finished successfully");

                for (const l of result.log)
                {
                    console.log(l);
                }
            }
            else {
                alert("Sync failed");
            }
        },
        error: () => alert("Sync failed")
    });
}