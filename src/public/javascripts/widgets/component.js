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

//        console.log(`Received ${name} to ${this.componentId}`);

        const fun = this[name + 'Listener'];

        let propagateToChildren = true;

        if (typeof fun === 'function') {
            propagateToChildren = await fun.call(this, data) !== false;
        }

        if (propagateToChildren) {
            for (const child of this.children) {
                child.eventReceived(name, data);
            }
        }
    }

    trigger(name, data) {
        this.appContext.trigger(name, data);
    }
}