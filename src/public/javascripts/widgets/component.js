export default class Component {
    /** @param {AppContext} appContext */
    constructor(appContext) {
        this.appContext = appContext;
        /** @type Component[] */
        this.children = [];
    }

    eventReceived(name, data) {
        const fun = this[name + 'Listener'];

        if (typeof fun === 'function') {
            fun.call(this, data);
        }

        for (const child of this.children) {
            child.eventReceived(name, data);
        }
    }

    trigger(name, data) {
        this.appContext.trigger(name, data);
    }
}