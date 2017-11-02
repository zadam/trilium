function checkStatus() {
    $.ajax({
        url: baseApiUrl + 'status/' + globalFullLoadTime,
        type: 'GET',
        success: resp => {
            if (resp.changed) {
                window.location.reload(true);
            }
            else {
                $("#changesToPushCount").html(resp.changesToPushCount);
            }
        },
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
}

setInterval(checkStatus, 10 * 1000);