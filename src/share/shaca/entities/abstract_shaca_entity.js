let shaca;

class AbstractShacaEntity {
    /** @return {Shaca} */
    get shaca() {
        if (!shaca) {
            shaca = require('../shaca.js');
        }

        return shaca;
    }
}

module.exports = AbstractShacaEntity;
