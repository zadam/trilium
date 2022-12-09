export default class ValidationError {
    constructor(resp) {
        for (const key in resp) {
            this[key] = resp[key];
        }
    }
}