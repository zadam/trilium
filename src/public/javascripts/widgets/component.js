import utils from '../services/utils.js';
import Mutex from "../services/mutex.js";

export default class Component {
    /** @param {AppContext} appContext */
    constructor(appContext) {
        this.componentId = `comp-${this.constructor.name}-` + utils.randomString(6);
        /** @type AppContext */
        this.appContext = appContext;
        /** @type TabManager */
        this.tabManager = appContext.tabManager;
        /** @type Component[] */
        this.children = [];
        this.initialized = Promise.resolve();
        this.mutex = new Mutex();
    }

    async eventReceived(name, data, sync = false) {
        await this.initialized;

        const fun = this[name + 'Listener'];

        let propagateToChildren = true;

        const start = Date.now();

        if (typeof fun === 'function') {
            let release;

            try {
                release = await this.mutex.acquire();

                propagateToChildren = await fun.call(this, data) !== false;
            }
            finally {
                if (release) {
                    release();
                }
            }
        }

        const end = Date.now();

        if (end - start > 10 && glob.PROFILING_LOG) {
            console.log(`Event ${name} in component ${this.componentId} took ${end-start}ms`);
        }

        if (propagateToChildren) {
            const promise = this.triggerChildren(name, data, sync);

            if (sync) {
                await promise;
            }
        }
    }

    trigger(name, data, sync = false) {
        this.appContext.trigger(name, data, sync);
    }

    async triggerChildren(name, data, sync = false) {
        const promises = [];

        for (const child of this.children) {
            promises.push(child.eventReceived(name, data, sync));
        }

        if (sync) {
            await Promise.all(promises);
        }
    }
}