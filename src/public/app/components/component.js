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
        this.componentId = `${this.sanitizedClassName}-${utils.randomString(8)}`;
        /** @type Component[] */
        this.children = [];
        this.initialized = null;
    }

    get sanitizedClassName() {
        // webpack mangles names and sometimes uses unsafe characters
        return this.constructor.name.replace(/[^A-Z0-9]/ig, "_");
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

    /** @returns {Promise} */
    handleEvent(name, data) {
        try {
            const callMethodPromise = this.initialized
                ? this.initialized.then(() => this.callMethod(this[`${name}Event`], data))
                : this.callMethod(this[`${name}Event`], data);

            const childrenPromise = this.handleEventInChildren(name, data);

            // don't create promises if not needed (optimization)
            return callMethodPromise && childrenPromise
                ? Promise.all([callMethodPromise, childrenPromise])
                : (callMethodPromise || childrenPromise);
        }
        catch (e) {
            console.error(`Handling of event '${name}' failed in ${this.constructor.name} with error ${e.message} ${e.stack}`);

            return null;
        }
    }

    /** @returns {Promise} */
    triggerEvent(name, data) {
        return this.parent.triggerEvent(name, data);
    }

    /** @returns {Promise} */
    handleEventInChildren(name, data) {
        const promises = [];

        for (const child of this.children) {
            const ret = child.handleEvent(name, data);

            if (ret) {
                promises.push(ret);
            }
        }

        // don't create promises if not needed (optimization)
        return promises.length > 0 ? Promise.all(promises) : null;
    }

    /** @returns {Promise} */
    triggerCommand(name, data = {}) {
        const fun = this[`${name}Command`];

        if (fun) {
            return this.callMethod(fun, data);
        }
        else {
            return this.parent.triggerCommand(name, data);
        }
    }

    callMethod(fun, data) {
        if (typeof fun !== 'function') {
            return;
        }

        const startTime = Date.now();

        const promise = fun.call(this, data);

        const took = Date.now() - startTime;

        if (glob.isDev && took > 20) { // measuring only sync handlers
            console.log(`Call to ${fun.name} in ${this.componentId} took ${took}ms`);
        }

        if (glob.isDev && promise) {
            return utils.timeLimit(promise, 20000, `Time limit failed on ${this.constructor.name} with ${fun.name}`);
        }

        return promise;
    }
}
