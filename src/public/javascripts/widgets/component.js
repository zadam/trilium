export default class Component {
    /** @param {AppContext} appContext */
    constructor(appContext) {
        this.componentId = `component-${this.constructor.name}`;
        this.appContext = appContext;
        /** @type Component[] */
        this.children = [];
        this.initialized = Promise.resolve();
    }

    async eventReceived(name, data) {
        await this.initialized;

        console.log(`Received ${name} to ${this.componentId}`);

        const fun = this[name + 'Listener'];

        if (typeof fun === 'function') {
            await fun.call(this, data);
        }

        for (const child of this.children) {
            child.eventReceived(name, data);
        }
    }

    trigger(name, data) {
        this.appContext.trigger(name, data);
    }
}