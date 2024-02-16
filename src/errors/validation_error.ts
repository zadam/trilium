class ValidationError {
    message: string;

    constructor(message: string) {
        this.message = message;
    }
}

module.exports = ValidationError;