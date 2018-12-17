"use strict";

const utils = require('./utils');
const url = require('url');

// this service provides abstraction over node's HTTP/HTTPS and electron net.client APIs
// this allows to support system proxy

// TODO: add proxy support - see https://stackoverflow.com/questions/3862813/how-can-i-use-an-http-proxy-with-node-js-http-client

function exec(opts) {
    const client = getClient(opts);
    const parsedUrl = url.parse(opts.url);

    return new Promise(async (resolve, reject) => {
        try {
            const headers = {
                Cookie: (opts.cookieJar && opts.cookieJar.header) || "",
                'Content-Type': 'application/json'
            };

            if (opts.auth) {
                const token = new Buffer(opts.auth.user + ":" + opts.auth.pass).toString('base64');

                headers['Authorization'] = `Basic ${token}`;
            }

            const request = client.request({
                method: opts.method,
                // url is used by electron net module
                url: opts.url,
                // 4 fields below are used by http and https node modules
                protocol: parsedUrl.protocol,
                host: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.path,
                timeout: opts.timeout,
                headers
            });

            request.on('response', response => {
                if (opts.cookieJar && response.headers['set-cookie']) {
                    opts.cookieJar.header = response.headers['set-cookie'];
                }

                let responseStr = '';

                response.on('data', chunk => responseStr += chunk);

                response.on('end', () => {
                    try {
                        const jsonObj = responseStr.trim() ? JSON.parse(responseStr) : null;

                        resolve(jsonObj);
                    }
                    catch (e) {
                        log.error("Failed to deserialize sync response: " + responseStr);

                        reject(generateError(e, opts));
                    }
                });
            });

            request.end(opts.body ? JSON.stringify(opts.body) : undefined);
        }
        catch (e) {
            reject(generateError(e, opts));
        }
    })
}

function getClient(opts) {
    if (utils.isElectron()) {
        return require('electron').net;
    }
    else {
        const {protocol} = url.parse(opts.url);

        if (protocol === 'http:' || protocol === 'https:') {
            return require(protocol.substr(0, protocol.length - 1));
        }
        else {
            throw new Error(`Unrecognized protocol "${protocol}"`);
        }
    }
}

function generateError(e, opts) {
    return new Error(`Request to ${opts.method} ${opts.url} failed, error: ${e.message}`);
}

module.exports = {
    exec
};