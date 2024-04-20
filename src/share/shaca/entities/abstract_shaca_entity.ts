import Shaca from "../shaca-interface";

let shaca: Shaca;

class AbstractShacaEntity {
    get shaca(): Shaca {
        if (!shaca) {
            shaca = require('../shaca');
        }

        return shaca;
    }
}

export = AbstractShacaEntity;
