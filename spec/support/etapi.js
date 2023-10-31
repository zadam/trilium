const {spawn} = require("child_process");
const kill  = require('tree-kill');

let etapiAuthToken;

const getEtapiAuthorizationHeader = () => "Basic " + Buffer.from(`etapi:${etapiAuthToken}`).toString('base64');

const PORT = '9999';
const HOST = 'http://localhost:' + PORT;

function describeEtapi(description, specDefinitions) {
    describe(description, () => {
        let appProcess;

        beforeAll(async () => {
            appProcess = spawn('npm', ['run', 'start-test-server']);

            await new Promise(res => {
                appProcess.stdout.on('data', data => {
                    console.log("Trilium: " + data.toString().trim());

                    if (data.toString().includes('Listening on port')) {
                        res();
                    }
                });
            });

            await fetch(HOST + '/api/setup/new-document', { method: 'POST' });

            const formData = new URLSearchParams();
            formData.append('password1', '1234');
            formData.append('password2', '1234');

            await fetch(HOST + '/set-password', { method: 'POST', body: formData });

            etapiAuthToken = (await (await fetch(HOST + '/etapi/auth/login', {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ password: '1234' })
            })).json()).authToken;
        });

        afterAll(() => {
            console.log("Attempting to kill the Trilium process as part of the cleanup...");
            kill(appProcess.pid, 'SIGKILL', () => { console.log("Trilium process killed.") });
        });

        specDefinitions();
    });
}

async function getEtapiResponse(url) {
    return await fetch(`${HOST}/etapi/${url}`, {
        method: 'GET',
        headers: {
            Authorization: getEtapiAuthorizationHeader()
        }
    });
}

async function getEtapi(url) {
    const response = await getEtapiResponse(url);
    return await processEtapiResponse(response);
}

async function getEtapiContent(url) {
    const response = await fetch(`${HOST}/etapi/${url}`, {
        method: 'GET',
        headers: {
            Authorization: getEtapiAuthorizationHeader()
        }
    });

    checkStatus(response);

    return response;
}

async function postEtapi(url, data = {}) {
    const response = await fetch(`${HOST}/etapi/${url}`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            Authorization: getEtapiAuthorizationHeader()
        },
        body: JSON.stringify(data)
    });
    return await processEtapiResponse(response);
}

async function postEtapiContent(url, data) {
    const response = await fetch(`${HOST}/etapi/${url}`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/octet-stream",
            Authorization: getEtapiAuthorizationHeader()
        },
        body: data
    });

    checkStatus(response);

    return response;
}

async function putEtapi(url, data = {}) {
    const response = await fetch(`${HOST}/etapi/${url}`, {
        method: 'PUT',
        headers: {
            "Content-Type": "application/json",
            Authorization: getEtapiAuthorizationHeader()
        },
        body: JSON.stringify(data)
    });
    return await processEtapiResponse(response);
}

async function putEtapiContent(url, data) {
    const response = await fetch(`${HOST}/etapi/${url}`, {
        method: 'PUT',
        headers: {
            "Content-Type": "application/octet-stream",
            Authorization: getEtapiAuthorizationHeader()
        },
        body: data
    });

    checkStatus(response);

    return response;
}

async function patchEtapi(url, data = {}) {
    const response = await fetch(`${HOST}/etapi/${url}`, {
        method: 'PATCH',
        headers: {
            "Content-Type": "application/json",
            Authorization: getEtapiAuthorizationHeader()
        },
        body: JSON.stringify(data)
    });
    return await processEtapiResponse(response);
}

async function deleteEtapi(url) {
    const response = await fetch(`${HOST}/etapi/${url}`, {
        method: 'DELETE',
        headers: {
            Authorization: getEtapiAuthorizationHeader()
        }
    });
    return await processEtapiResponse(response);
}

async function processEtapiResponse(response) {
    const text = await response.text();

    if (response.status < 200 || response.status >= 300) {
        throw new Error(`ETAPI error ${response.status}: ` + text);
    }

    return text?.trim() ? JSON.parse(text) : null;
}

function checkStatus(response) {
    if (response.status < 200 || response.status >= 300) {
        throw new Error(`ETAPI error ${response.status}`);
    }
}

module.exports = {
    describeEtapi,
    getEtapi,
    getEtapiResponse,
    getEtapiContent,
    postEtapi,
    postEtapiContent,
    putEtapi,
    putEtapiContent,
    patchEtapi,
    deleteEtapi
};
