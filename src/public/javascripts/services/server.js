import utils from './utils.js';
import toastService from "./toast.js";

const REQUEST_LOGGING_ENABLED = false;

function getHeaders(headers) {
    // headers need to be lowercase because node.js automatically converts them to lower case
    // so hypothetical protectedSessionId becomes protectedsessionid on the backend
    // also avoiding using underscores instead of dashes since nginx filters them out by default
    const allHeaders = {
        ...{
            'trilium-source-id': glob.sourceId,
            'x-csrf-token': glob.csrfToken
        },
        ...headers
    };

    if (utils.isElectron()) {
        // passing it explicitely here because of the electron HTTP bypass
        allHeaders.cookie = document.cookie;
    }

    return allHeaders;
}

async function get(url, headers = {}) {
    return await call('GET', url, null, headers);
}

async function post(url, data, headers = {}) {
    return await call('POST', url, data, headers);
}

async function put(url, data, headers = {}) {
    return await call('PUT', url, data, headers);
}

async function remove(url, headers = {}) {
    return await call('DELETE', url, null, headers);
}

let i = 1;
const reqResolves = {};

async function call(method, url, data, headers = {}) {
    if (utils.isElectron()) {
        const ipc = require('electron').ipcRenderer;
        const requestId = i++;

        return new Promise((resolve, reject) => {
            reqResolves[requestId] = resolve;

            if (REQUEST_LOGGING_ENABLED) {
                console.log(utils.now(), "Request #" + requestId + " to " + method + " " + url);
            }

            ipc.send('server-request', {
                requestId: requestId,
                headers: getHeaders(headers),
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

async function ajax(url, method, data) {
    const options = {
        url: baseApiUrl + url,
        type: method,
        headers: getHeaders(),
        timeout: 60000
    };

    if (data) {
        try {
            options.data = JSON.stringify(data);
        }
        catch (e) {
            console.log("Can't stringify data: ", data, " because of error: ", e)
        }
        options.contentType = "application/json";
    }

    return await $.ajax(options).catch(e => {
        const message = "Error when calling " + method + " " + url + ": " + e.status + " - " + e.statusText;
        toastService.showError(message);
        toastService.throwError(message);
    });
}

if (utils.isElectron()) {
    const ipc = require('electron').ipcRenderer;

    ipc.on('server-response', (event, arg) => {
        if (REQUEST_LOGGING_ENABLED) {
            console.log(utils.now(), "Response #" + arg.requestId + ": " + arg.statusCode);
        }

        reqResolves[arg.requestId](arg.body);

        delete reqResolves[arg.requestId];
    });
}

export default {
    get,
    post,
    put,
    remove,
    ajax,
    // don't remove, used from CKEditor image upload!
    getHeaders
};