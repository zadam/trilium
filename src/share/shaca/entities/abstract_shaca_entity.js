import importSync from "import-sync";

let shaca;

class AbstractShacaEntity {
    /** @return {Shaca} */
    get shaca() {
        if (!shaca) {
            shaca = importSync('../shaca.js');
        }

        return shaca;
    }
}

export default AbstractShacaEntity;
