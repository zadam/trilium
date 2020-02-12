export default class Mutex {
    constructor() {
        this.queue = [];
        this.pending = false;
    }

    isLocked() {
        return this.pending;
    }

    acquire() {
        const ticket = new Promise(resolve => this.queue.push(resolve));
        
        if (!this.pending) {
            this.dispatchNext();
        }
        
        return ticket;
    }
    
    dispatchNext() {
        if (this.queue.length > 0) {
            this.pending = true;
            this.queue.shift()(this.dispatchNext.bind(this));
        } else {
            this.pending = false;
        }
    }
}