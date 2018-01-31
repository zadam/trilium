const server = (function() {
    function getHeaders() {
        let protectedSessionId = null;

        try { // this is because protected session might not be declared in some cases - like when it's included in migration page
            protectedSessionId = protected_session.getProtectedSessionId();
        }
        catch(e) {}

        // headers need to be lowercase because node.js automatically converts them to lower case
        // so hypothetical protectedSessionId becomes protectedsessionid on the backend
        return {
            protected_session_id: protectedSessionId,
            source_id: glob.sourceId
        };
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

    async function exec(params, script) {
        if (typeof script === "function") {
            script = script.toString();
        }

        const ret = await post('script/exec', { script: script, params: params });

        return ret.executionResult;
    }

    let i = 1;
    const reqResolves = {};

    async function call(method, url, data) {
        if (isElectron()) {
            const ipc = require('electron').ipcRenderer;
            const requestId = i++;

            return new Promise((resolve, reject) => {
                reqResolves[requestId] = resolve;

                console.log(now(), "Request #" + requestId + " to " + method + " " + url);

                ipc.send('server-request', {
                    requestId: requestId,
                    headers: getHeaders(),
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
            console.log(now(), "Response #" + arg.requestId + ": " + arg.statusCode);

            reqResolves[arg.requestId](arg.body);

            delete reqResolves[arg.requestId];
        });
    }

    async function ajax(url, method, data) {
        const options = {
            url: baseApiUrl + url,
            type: method,
            headers: getHeaders()
        };

        if (data) {
            options.data = JSON.stringify(data);
            options.contentType = "application/json";
        }

        return await $.ajax(options).catch(e => {
            const message = "Error when calling " + method + " " + url + ": " + e.status + " - " + e.statusText;
            showError(message);
            throwError(message);
        });
    }

    return {
        get,
        post,
        put,
        remove,
        exec
    }
})();