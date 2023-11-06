import utils from './utils.js';
import ValidationError from "./validation_error.js";

async function getHeaders(headers) {
    const appContext = (await import('../components/app_context.js')).default;
    const activeNoteContext = appContext.tabManager ? appContext.tabManager.getActiveContext() : null;

    // headers need to be lowercase because node.js automatically converts them to lower case
    // also avoiding using underscores instead of dashes since nginx filters them out by default
    const allHeaders = {
        'trilium-component-id': glob.componentId,
        'trilium-local-now-datetime': utils.localNowDateTime(),
        'trilium-hoisted-note-id': activeNoteContext ? activeNoteContext.hoistedNoteId : null,
        'x-csrf-token': glob.csrfToken
    };

    for (const headerName in headers) {
        if (headers[headerName]) {
            allHeaders[headerName] = headers[headerName];
        }
    }

    if (utils.isElectron()) {
        // passing it explicitly here because of the electron HTTP bypass
        allHeaders.cookie = document.cookie;
    }

    return allHeaders;
}

async function getWithSilentNotFound(url, componentId) {
    return await call('GET', url, componentId, { silentNotFound: true });
}

async function get(url, componentId) {
    return await call('GET', url, componentId);
}

async function post(url, data, componentId) {
    return await call('POST', url, componentId, { data });
}

async function put(url, data, componentId) {
    return await call('PUT', url, componentId, { data });
}

async function patch(url, data, componentId) {
    return await call('PATCH', url, componentId, { data });
}

async function remove(url, componentId) {
    return await call('DELETE', url, componentId);
}

async function upload(url, fileToUpload) {
    const formData = new FormData();
    formData.append('upload', fileToUpload);

    return await $.ajax({
        url: window.glob.baseApiUrl + url,
        headers: await getHeaders(),
        data: formData,
        type: 'PUT',
        timeout: 60 * 60 * 1000,
        contentType: false, // NEEDED, DON'T REMOVE THIS
        processData: false, // NEEDED, DON'T REMOVE THIS
    });
}

let idCounter = 1;
const idToRequestMap = {};

let maxKnownEntityChangeId = 0;

async function call(method, url, componentId, options = {}) {
    let resp;

    const headers = await getHeaders({
        'trilium-component-id': componentId
    });
    const {data} = options;

    if (utils.isElectron()) {
        const ipc = utils.dynamicRequire('electron').ipcRenderer;
        const requestId = idCounter++;

        resp = await new Promise((resolve, reject) => {
            idToRequestMap[requestId] = {
                resolve,
                reject,
                silentNotFound: !!options.silentNotFound
            };

            ipc.send('server-request', {
                requestId: requestId,
                headers: headers,
                method: method,
                url: `/${window.glob.baseApiUrl}${url}`,
                data: data
            });
        });
    }
    else {
        resp = await ajax(url, method, data, headers, !!options.silentNotFound);
    }

    const maxEntityChangeIdStr = resp.headers['trilium-max-entity-change-id'];

    if (maxEntityChangeIdStr && maxEntityChangeIdStr.trim()) {
        maxKnownEntityChangeId = Math.max(maxKnownEntityChangeId, parseInt(maxEntityChangeIdStr));
    }

    return resp.body;
}

function ajax(url, method, data, headers, silentNotFound) {
    return new Promise((res, rej) => {
        const options = {
            url: window.glob.baseApiUrl + url,
            type: method,
            headers: headers,
            timeout: 60000,
            success: (body, textStatus, jqXhr) => {
                const respHeaders = {};

                jqXhr.getAllResponseHeaders().trim().split(/[\r\n]+/).forEach(line => {
                    const parts = line.split(': ');
                    const header = parts.shift();
                    respHeaders[header] = parts.join(': ');
                });

                res({
                    body,
                    headers: respHeaders
                });
            },
            error: async jqXhr => {
                if (silentNotFound && jqXhr.status === 404) {
                    // report nothing
                } else {
                    await reportError(method, url, jqXhr.status, jqXhr.responseText);
                }

                rej(jqXhr.responseText);
            }
        };

        if (data) {
            try {
                options.data = JSON.stringify(data);
            } catch (e) {
                console.log("Can't stringify data: ", data, " because of error: ", e)
            }
            options.contentType = "application/json";
        }

        $.ajax(options);
    });
}

if (utils.isElectron()) {
    const ipc = utils.dynamicRequire('electron').ipcRenderer;

    ipc.on('server-response', async (event, arg) => {
        if (arg.statusCode >= 200 && arg.statusCode < 300) {
            handleSuccessfulResponse(arg);
        }
        else {
            if (arg.statusCode === 404 && idToRequestMap[arg.requestId]?.silentNotFound) {
                // report nothing
            } else {
                await reportError(arg.method, arg.url, arg.statusCode, arg.body);
            }

            idToRequestMap[arg.requestId].reject(new Error(`Server responded with ${arg.statusCode}`));
        }

        delete idToRequestMap[arg.requestId];
    });

    function handleSuccessfulResponse(arg) {
        if (arg.headers['Content-Type'] === 'application/json') {
            arg.body = JSON.parse(arg.body);
        }

        if (!(arg.requestId in idToRequestMap)) {
            // this can happen when reload happens between firing up the request and receiving the response
            throw new Error(`Unknown requestId '${arg.requestId}'`);
        }

        idToRequestMap[arg.requestId].resolve({
            body: arg.body,
            headers: arg.headers
        });
    }
}

async function reportError(method, url, statusCode, response) {
    let message = response;

    if (typeof response === 'string') {
        try {
            response = JSON.parse(response);
            message = response.message;
        }
        catch (e) {}
    }

    const toastService = (await import("./toast.js")).default;

    if ([400, 404].includes(statusCode) && response && typeof response === 'object') {
        toastService.showError(message);
        throw new ValidationError({
            requestUrl: url,
            method,
            statusCode,
            ...response
        });
    } else {
        const title = `${statusCode} ${method} ${url}`;
        toastService.showErrorTitleAndMessage(title, message);
        toastService.throwError(`${title} - ${message}`);
    }
}

export default {
    get,
    getWithSilentNotFound,
    post,
    put,
    patch,
    remove,
    upload,
    // don't remove, used from CKEditor image upload!
    getHeaders,
    getMaxKnownEntityChangeId: () => maxKnownEntityChangeId
};
