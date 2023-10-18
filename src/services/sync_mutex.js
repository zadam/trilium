/**
 * Sync process can make data intermittently inconsistent. Processes which require strong data consistency
 * (like consistency checks) can use this mutex to make sure sync isn't currently running.
 */

const Mutex = require('async-mutex').Mutex;
const instance = new Mutex();

async function doExclusively(func) {
    const releaseMutex = await instance.acquire();

    try {
        return await func();
    }
    finally {
        releaseMutex();
    }
}

module.exports = {
    doExclusively
};
