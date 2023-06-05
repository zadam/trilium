let shaca;

class AbstractShacaEntity {
    /** @return {Shaca} */
    get shaca() {
        if (!shaca) {
            shaca = require("../shaca");
        }

        return shaca;
    }
}

module.exports = AbstractShacaEntity;
