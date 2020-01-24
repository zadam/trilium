export default class Component {
    /** @param {AppContext} appContext */
    constructor(appContext) {
        this.componentId = `component-${this.constructor.name}`;
        this.appContext = appContext;
        /** @type Component[] */
        this.children = [];
        this.initialized = Promise.resolve();
    }

    async eventReceived(name, data, sync = false) {
        await this.initialized;

        console.log(`Received ${name} to ${this.componentId}`);

        const fun = this[name + 'Listener'];

        let propagateToChildren = true;

        if (typeof fun === 'function') {
            propagateToChildren = await fun.call(this, data) !== false;
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