import server from "./server.js";

let optionsReady;

const loadListeners = [];

class Options {
    constructor(arr) {
        this.arr = arr;
    }

    get(key) {
        return this.arr[key];
    }

    getNames() {
        return Object.keys(this.arr);
    }

    getJson(key) {
        try {
            return JSON.parse(this.arr[key]);
        }
        catch (e) {
            return null;
        }
    }

    getInt(key) {
        return parseInt(this.arr[key]);
    }

    getFloat(key) {
        return parseFloat(this.arr[key]);
    }

    is(key) {
        return this.arr[key] === 'true';
    }
}

function reloadOptions() {
    optionsReady = new Promise((resolve, reject) => {
        server.get('options').then(optionArr => {
            const options = new Options(optionArr);

            resolve(options);

            for (const listener of loadListeners) {
                listener(options);
            }
        });
    });

    return optionsReady;
}

/**
 * just waits for some options without triggering reload
 *
 * @return {Options}
 */
async function waitForOptions() {
    return await optionsReady;
}

reloadOptions(); // initial load

function addLoadListener(listener) {
    loadListeners.push(listener);

    // useful when listener has been added after the promise resolved, but can cause double emit if not yet
    // that should not be an issue though
    optionsReady.then(listener);
}

export default {
    addLoadListener,
    reloadOptions,
    waitForOptions
}