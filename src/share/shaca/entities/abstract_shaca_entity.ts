let shaca: any;

class AbstractShacaEntity {
    // FIXME: Use right data type once we convert Shaca as well.
    get shaca(): any {
        if (!shaca) {
            shaca = require('../shaca.js');
        }

        return shaca;
    }
}

export = AbstractShacaEntity;
