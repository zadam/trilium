let shaca;

class AbstractShacaEntity {
    get shaca() {
        if (!shaca) {
            shaca = require("../shaca");
        }

        return shaca;
    }
}

module.exports = AbstractShacaEntity;
