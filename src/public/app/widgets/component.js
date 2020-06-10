import utils from '../services/utils.js';

/**
 * Abstract class for all components in the Trilium's frontend.
 *
 * Contains also event implementation with following properties:
 * - event / command distribution is synchronous which among others mean that events are well ordered - event
 *   which was sent out first will also be processed first by the component
 * - execution of the event / command is asynchronous - each component executes the event on its own without regard for
 *   other components.
 * - although the execution is async, we are collecting all the promises and therefore it is possible to wait until the
 *   event / command is executed in all components - by simply awaiting the `triggerEvent()`.
 */
export default class Component {
    constructor() {
        this.componentId = `comp-` + utils.randomString(8);
        /** @type Component[] */
        this.children = [];
        this.initialized = Promise.resolve();
    }

    setParent(parent) {
        /** @type Component */
        this.parent = parent;
        return this;
    }

    child(...components) {
        for (const component of components) {
            component.setParent(this);

            this.children.push(component);
        }

        return this;
    }

    /** @return {Promise} */
    handleEvent(name, data) {
        return Promise.all([
            this.initialized.then(() => this.callMethod(this[name + 'Event'], data)),
            this.handleEventInChildren(name, data)
        ]);
    }

    /** @return {Promise} */
    triggerEvent(name, data) {
        return this.parent.triggerEvent(name, data);
    }

    /** @return {Promise} */
    handleEventInChildren(name, data) {
        const promises = [];

        for (const child of this.children) {
            promises.push(child.handleEvent(name, data));
        }

        return Promise.all(promises);
    }

    /** @return {Promise} */
    triggerCommand(name, data = {}) {
        const fun = this[name + 'Command'];

        if (fun) {
            return this.callMethod(fun, data);
        }
        else {
            return this.parent.triggerCommand(name, data);
        }
    }

    async callMethod(fun, data) {
        if (typeof fun !== 'function') {
            return false;
        }

        await fun.call(this, data);

        return true;
    }
}
