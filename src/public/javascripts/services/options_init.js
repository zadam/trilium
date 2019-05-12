import server from "./server.js";

let optionsReady;

const loadListeners = [];

function loadOptions() {
    optionsReady = new Promise((resolve, reject) => {
        server.get('options').then(options => {
            resolve(options);

            for (const listener of loadListeners) {
                listener(options);
            }
        });
    });
}

loadOptions(); // initial load

function addLoadListener(listener) {
    loadListeners.push(listener);

    // useful when listener has been added after the promise resolved, but can cause double emit if not yet
    // that should not be an issue though
    optionsReady.then(listener);
}

export default {
    // use addLoadListener() which will be called also on refreshes
    optionsReady,
    addLoadListener,
    loadOptions
}