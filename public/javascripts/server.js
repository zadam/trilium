const server = (function() {
    function initAjax() {
        $.ajaxSetup({
            headers: {
                'x-protected-session-id': typeof protected_session !== 'undefined' ? protected_session.getProtectedSessionId() : null
            }
        });
    }

    async function get(url) {
        return await call('GET', url);
    }

    async function post(url, data) {
        return await call('POST', url, data);
    }

    async function put(url, data) {
        return await call('PUT', url, data);
    }

    async function remove(url) {
        return await call('DELETE', url);
    }

    let i = 1;
    const reqResolves = {};

    async function call(method, url, data) {
        if (isElectron()) {
            const ipc = require('electron').ipcRenderer;
            const requestId = i++;

            return new Promise((resolve, reject) => {
                reqResolves[requestId] = resolve;

                ipc.send('server-request', {
                    requestId: requestId,
                    method: method,
                    url: "/" + baseApiUrl + url,
                    data: data
                });
            });
        }
        else {
            return await ajax(url, method, data);
        }
    }

    if (isElectron()) {
        const ipc = require('electron').ipcRenderer;

        ipc.on('server-response', (event, arg) => {
            reqResolves[arg.requestId](arg.body);
        });
    }

    async function ajax(url, method, data) {
        const options = {
            url: baseApiUrl + url,
            type: method
        };

        if (data) {
            options.data = JSON.stringify(data);
            options.contentType = "application/json";
        }

        return await $.ajax(options).catch(e => {
            showError("Error when calling " + method + " " + url + ": " + e.status + " - " + e.statusText);
        });
    }


    initAjax();

    return {
        get,
        post,
        put,
        remove,
        initAjax
    }
})();