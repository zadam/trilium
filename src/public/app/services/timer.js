// https://stackoverflow.com/a/3969760
export default class Timer {
    timerId;
    start;
    remaining;
    callback;

    constructor(callback, delay) {
        this.remaining = delay;
        this.callback = callback;

        this.resume()
    }

    pause() {
        clearTimeout(this.timerId);
        this.remaining -= Date.now() - this.start;
    }

    resume() {
        this.start = Date.now();
        clearTimeout(this.timerId);
        this.timerId = setTimeout(this.callback, this.remaining);
    }

    clear() {
        clearTimeout(this.timerId);
    }
}
