const shaca = require("./shaca/shaca");
const shacaLoader = require("./shaca/shaca_loader");

function register(router) {
    router.get('/share/:noteId', (req, res, next) => {
        const {noteId} = req.params;

        shacaLoader.ensureLoad();

        if (noteId in shaca.notes) {
            res.send(shaca.notes[noteId].title);
        }
        else {
            res.send("FFF");
        }
    });
}

module.exports = {
    register
}
