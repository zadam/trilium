"use strict";

const utils = require('./utils.js');
const log = require('./log.js');
const url = require('url');
const syncOptions = require('./sync_options.js');

// this service provides abstraction over node's HTTP/HTTPS and electron net.client APIs
// this allows supporting system proxy

function exec(opts) {
    const client = getClient(opts);

    // hack for cases where electron.net does not work, but we don't want to set proxy
    if (opts.proxy === 'noproxy') {
        opts.proxy = null;
    }

    if (!opts.paging) {
        opts.paging = {
            pageCount: 1,
            pageIndex: 0,
            requestId: 'n/a'
        };
    }

    const proxyAgent = getProxyAgent(opts);
    const parsedTargetUrl = url.parse(opts.url);

    return new Promise((resolve, reject) => {
        try {
            const headers = {
                Cookie: (opts.cookieJar && opts.cookieJar.header) || "",
                'Content-Type': opts.paging.pageCount === 1 ? 'application/json' : 'text/plain',
                pageCount: opts.paging.pageCount,
                pageIndex: opts.paging.pageIndex,
                requestId: opts.paging.requestId
            };

            if (opts.auth) {
                headers['trilium-cred'] = Buffer.from(`dummy:${opts.auth.password}`).toString('base64');
            }

            const request = client.request({
                method: opts.method,
                // url is used by electron net module
                url: opts.url,
                // 4 fields below are used by http and https node modules
                protocol: parsedTargetUrl.protocol,
                host: parsedTargetUrl.hostname,
                port: parsedTargetUrl.port,
                path: parsedTargetUrl.path,
                timeout: opts.timeout, // works only for node.js client
                headers,
                agent: proxyAgent
            });

            request.on('error', err => reject(generateError(opts, err)));

            request.on('response', response => {
                if (opts.cookieJar && response.headers['set-cookie']) {
                    opts.cookieJar.header = response.headers['set-cookie'];
                }

                let responseStr = '';

                response.on('data', chunk => responseStr += chunk);

                response.on('end', () => {
                    if ([200, 201, 204].includes(response.statusCode)) {
                        try {
                            const jsonObj = responseStr.trim() ? JSON.parse(responseStr) : null;

                            resolve(jsonObj);
                        } catch (e) {
                            log.error(`Failed to deserialize sync response: ${responseStr}`);

                            reject(generateError(opts, e.message));
                        }
                    } else {
                        let errorMessage;

                        try {
                            const jsonObj = JSON.parse(responseStr);

                            errorMessage = jsonObj?.message || '';
                        } catch (e) {
                            errorMessage = responseStr.substr(0, Math.min(responseStr.length, 100));
                        }

                        reject(generateError(opts, `${response.statusCode} ${response.statusMessage} ${errorMessage}`));
                    }
                });
            });

            let payload;

            if (opts.body) {
                payload = typeof opts.body === 'object'
                    ? JSON.stringify(opts.body)
                    : opts.body;
            }

            request.end(payload);
        }
        catch (e) {
            reject(generateError(opts, e.message));
        }
    });
}

function getImage(imageUrl) {
    const proxyConf = syncOptions.getSyncProxy();
    const opts = {
        method: 'GET',
        url: imageUrl,
        proxy: proxyConf !== "noproxy" ? proxyConf : null
    };

    const client = getClient(opts);
    const proxyAgent = getProxyAgent(opts);
    const parsedTargetUrl = url.parse(opts.url);

    return new Promise((resolve, reject) => {
        try {
            const request = client.request({
                method: opts.method,
                // url is used by electron net module
                url: opts.url,
                // 4 fields below are used by http and https node modules
                protocol: parsedTargetUrl.protocol,
                host: parsedTargetUrl.hostname,
                port: parsedTargetUrl.port,
                path: parsedTargetUrl.path,
                timeout: opts.timeout, // works only for the node client
                headers: {},
                agent: proxyAgent
            });

            request.on('error', err => reject(generateError(opts, err)));

            request.on('abort', err => reject(generateError(opts, err)));

            request.on('response', response => {
                if (![200, 201, 204].includes(response.statusCode)) {
                    reject(generateError(opts, `${response.statusCode} ${response.statusMessage}`));
                }

                const chunks = []

                response.on('data', chunk => chunks.push(chunk));
                response.on('end', () => resolve(Buffer.concat(chunks)));
            });

            request.end(undefined);
        }
        catch (e) {
            reject(generateError(opts, e.message));
        }
    });
}

const HTTP = 'http:', HTTPS = 'https:';

function getProxyAgent(opts) {
    if (!opts.proxy) {
        return null;
    }

    const {protocol} = url.parse(opts.url);

    if (![HTTP, HTTPS].includes(protocol)) {
        return null;
    }

    const AgentClass = HTTP === protocol
        ? require("http-proxy-agent").HttpProxyAgent
        : require("https-proxy-agent").HttpsProxyAgent;

    return new AgentClass(opts.proxy);
}

function getClient(opts) {
    // it's not clear how to explicitly configure proxy (as opposed to system proxy),
    // so in that case, we always use node's modules
    if (utils.isElectron() && !opts.proxy) {
        return require('electron').net;
    }
    else {
        const {protocol} = url.parse(opts.url);

        if (protocol === 'http:' || protocol === 'https:') {
            return require(protocol.substr(0, protocol.length - 1));
        }
        else {
            throw new Error(`Unrecognized protocol '${protocol}'`);
        }
    }
}

function generateError(opts, message) {
    return new Error(`Request to ${opts.method} ${opts.url} failed, error: ${message}`);
}

module.exports = {
    exec,
    getImage
};
