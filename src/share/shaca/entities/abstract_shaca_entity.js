import shaca0 from '../shaca.js'

let shaca;

class AbstractShacaEntity {
    /** @return {Shaca} */
    get shaca() {
        if (!shaca) {
            shaca = shaca0;
        }

        return shaca;
    }
}

export default AbstractShacaEntity;
