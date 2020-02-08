import utils from '../services/utils.js';

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
    }

    async eventReceived(name, data, sync = false) {
        await this.initialized;

        const fun = this[name + 'Listener'];

        let propagateToChildren = true;

        const start = Date.now();

        if (typeof fun === 'function') {
            propagateToChildren = await fun.call(this, data) !== false;
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
        for (const child of this.children) {
            let promise = child.eventReceived(name, data, sync);

            if (sync) {
                await promise;
            }
        }
    }
}