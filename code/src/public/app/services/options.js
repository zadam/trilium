import server from "./server.js";

class Options {
    constructor() {
        this.initializedPromise = server.get('options').then(data => this.load(data));
    }

    load(arr) {
        this.arr = arr;
    }

    get(key) {
        return this.arr[key];
    }

    getNames() {
        return Object.keys(this.arr);
    }

    getJson(key) {
        try {
            return JSON.parse(this.arr[key]);
        }
        catch (e) {
            return null;
        }
    }

    getInt(key) {
        return parseInt(this.arr[key]);
    }

    getFloat(key) {
        return parseFloat(this.arr[key]);
    }

    is(key) {
        return this.arr[key] === 'true';
    }

    set(key, value) {
        this.arr[key] = value;
    }

    async save(key, value) {
        this.set(key, value);

        const payload = {};
        payload[key] = value;

        await server.put(`options`, payload);
    }

    async toggle(key) {
        await this.save(key, (!this.is(key)).toString());
    }
}

const options = new Options();

export default options;
