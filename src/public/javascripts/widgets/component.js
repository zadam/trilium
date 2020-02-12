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

    async eventReceived(name, data) {
        await this.initialized;

        const fun = this[name + 'Listener'];

        const start = Date.now();

        if (typeof fun === 'function') {
            let release;

            try {
                release = await this.mutex.acquire();

                await fun.call(this, data);
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

        await this.triggerChildren(name, data);
    }

    async trigger(name, data) {
        await this.appContext.trigger(name, data);
    }

    async triggerChildren(name, data) {
        const promises = [];

        for (const child of this.children) {
            promises.push(child.eventReceived(name, data));
        }

        await Promise.all(promises);
    }
}