#!/usr/bin/env node

// setup basic error handling even before requiring dependencies, since those can produce errors as well

process.on('unhandledRejection', error => {
    // this makes sure that stacktrace of failed promise is printed out
    console.log(error);

    // but also try to log it into file
    require('./services/log').info(error);
});

function exit() {
    console.log("Caught interrupt/termination signal. Exiting.");
    process.exit(0);
}

process.on('SIGINT', exit);
process.on('SIGTERM', exit);

const app = require('./app');
const sessionParser = require('./routes/session_parser');
const fs = require('fs');
const http = require('http');
const https = require('https');
const config = require('./services/config');
const log = require('./services/log');
const appInfo = require('./services/app_info');
const ws = require('./services/ws');
const utils = require('./services/utils');
const port = require('./services/port');
const host = require('./services/host');
const semver = require('semver');

if (!semver.satisfies(process.version, ">=10.5.0")) {
    console.error("Trilium only supports node.js 10.5 and later");
    process.exit(1);
}

startTrilium();

function startTrilium() {
    /**
     * The intended behavior is to detect when a second instance is running, in that case open the old instance
     * instead of the new one. This is complicated by the fact that it is possible to run multiple instances of Trilium
     * if port and data dir are configured separately. This complication is the source of the following weird usage.
     *
     * The line below makes sure that the "second-instance" (process in window.js) is fired. Normally it returns a boolean
     * indicating whether another instance is running or not, but we ignore that and kill the app only based on the port conflict.
     *
     * A bit weird is that "second-instance" is triggered also on the valid usecases (different port/data dir) and
     * focuses the existing window. But the new process is start as well and will steal the focus too, it will win, because
     * its startup is slower than focusing the existing process/window. So in the end, it works out without having
     * to do a complex evaluation.
     */
    if (utils.isElectron()) {
        require("electron").app.requestSingleInstanceLock();
    }

    log.info(JSON.stringify(appInfo, null, 2));

    const cpuInfos = require('os').cpus();
    log.info(`CPU model: ${cpuInfos[0].model}, logical cores: ${cpuInfos.length} freq: ${cpuInfos[0].speed} Mhz`); // for perf. issues it's good to know the rough configuration

    const httpServer = startHttpServer();

    ws.init(httpServer, sessionParser);

    if (utils.isElectron()) {
        const electronRouting = require('./routes/electron');
        electronRouting(app);
    }
}

function startHttpServer() {
    app.set('port', port);
    app.set('host', host);

    // Check from config whether to trust reverse proxies to supply user IPs, hostnames and protocols
    if (config['Network']['trustedReverseProxy']) {
        if (config['Network']['trustedReverseProxy'] === true || config['Network']['trustedReverseProxy'].trim().length) {
            app.set('trust proxy', config['Network']['trustedReverseProxy'])
        }
    }

    log.info(`Trusted reverse proxy: ${app.get('trust proxy')}`)

    let httpServer;

    if (config['Network']['https']) {
        if (!config['Network']['keyPath'] || !config['Network']['keyPath'].trim().length) {
            throw new Error("keyPath in config.ini is required when https=true, but it's empty");
        }

        if (!config['Network']['certPath'] || !config['Network']['certPath'].trim().length) {
            throw new Error("certPath in config.ini is required when https=true, but it's empty");
        }

        const options = {
            key: fs.readFileSync(config['Network']['keyPath']),
            cert: fs.readFileSync(config['Network']['certPath'])
        };

        httpServer = https.createServer(options, app);

        log.info(`App HTTPS server starting up at port ${port}`);
    } else {
        httpServer = http.createServer(app);

        log.info(`App HTTP server starting up at port ${port}`);
    }

    /**
     * Listen on provided port, on all network interfaces.
     */

    httpServer.keepAliveTimeout = 120000 * 5;
    const listenOnTcp = port !== 0;

    if (listenOnTcp) {
        httpServer.listen(port, host); // TCP socket.
    } else {
        httpServer.listen(host); // Unix socket.
    }

    httpServer.on('error', error => {
            if (!listenOnTcp || error.syscall !== 'listen') {
                throw error;
            }

            // handle specific listen errors with friendly messages
            switch (error.code) {
                case 'EACCES':
                    console.error(`Port ${port} requires elevated privileges. It's recommended to use port above 1024.`);
                    process.exit(1);
                    break;

                case 'EADDRINUSE':
                    console.error(`Port ${port} is already in use. Most likely, another Trilium process is already running. You might try to find it, kill it, and try again.`);
                    process.exit(1);
                    break;

                default:
                    throw error;
            }
        }
    )

    httpServer.on('listening', () => {
        if (listenOnTcp) {
            log.info(`Listening on port ${port}`)
        } else {
            log.info(`Listening on unix socket ${host}`)
        }
    });

    return httpServer;
}
