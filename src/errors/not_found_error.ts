class NotFoundError {
    message: string;

    constructor(message: string) {
        this.message = message;
    }
}

module.exports = NotFoundError;