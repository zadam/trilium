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
        // passing it explicitely here because of the electron HTTP bypass
        allHeaders.cookie = document.cookie;
    }

    return allHeaders;
}

async function get(url, componentId) {
    return await call('GET', url, null, {'trilium-component-id': componentId});
}

async function post(url, data, componentId) {
    return await call('POST', url, data, {'trilium-component-id': componentId});
}

async function put(url, data, componentId) {
    return await call('PUT', url, data, {'trilium-component-id': componentId});
}

async function patch(url, data, componentId) {
    return await call('PATCH', url, data, {'trilium-component-id': componentId});
}

async function remove(url, componentId) {
    return await call('DELETE', url, null, {'trilium-component-id': componentId});
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

let i = 1;
const reqResolves = {};
const reqRejects = {};

let maxKnownEntityChangeId = 0;

async function call(method, url, data, headers = {}) {
    let resp;

    headers = await getHeaders(headers);

    if (utils.isElectron()) {
        const ipc = utils.dynamicRequire('electron').ipcRenderer;
        const requestId = i++;

        resp = await new Promise((resolve, reject) => {
            reqResolves[requestId] = resolve;
            reqRejects[requestId] = reject;

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
        resp = await ajax(url, method, data, headers);
    }

    const maxEntityChangeIdStr = resp.headers['trilium-max-entity-change-id'];

    if (maxEntityChangeIdStr && maxEntityChangeIdStr.trim()) {
        maxKnownEntityChangeId = Math.max(maxKnownEntityChangeId, parseInt(maxEntityChangeIdStr));
    }

    return resp.body;
}

function ajax(url, method, data, headers) {
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
                await reportError(method, url, jqXhr.status, jqXhr.responseText);

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
            await reportError(arg.method, arg.url, arg.statusCode, arg.body);

            reqRejects[arg.requestId]();
        }

        delete reqResolves[arg.requestId];
        delete reqRejects[arg.requestId];
    });

    function handleSuccessfulResponse(arg) {
        if (arg.headers['Content-Type'] === 'application/json') {
            arg.body = JSON.parse(arg.body);
        }

        if (!(arg.requestId in reqResolves)) {
            // this can happen when reload happens between firing up the request and receiving the response
            throw new Error(`Unknown requestId="${arg.requestId}"`);
        }

        reqResolves[arg.requestId]({
            body: arg.body,
            headers: arg.headers
        });
    }
}

async function reportError(method, url, statusCode, response) {
    const toastService = (await import("./toast.js")).default;
    let message = response;

    if (typeof response === 'string') {
        try {
            response = JSON.parse(response);
            message = response.message;
        }
        catch (e) {}
    }

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
    post,
    put,
    patch,
    remove,
    upload,
    // don't remove, used from CKEditor image upload!
    getHeaders,
    getMaxKnownEntityChangeId: () => maxKnownEntityChangeId
};
