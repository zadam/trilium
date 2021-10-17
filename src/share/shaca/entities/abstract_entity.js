let shaca;

class AbstractEntity {
    get shaca() {
        if (!shaca) {
            shaca = require("../shaca");
        }

        return shaca;
    }
}

module.exports = AbstractEntity;
