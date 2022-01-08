const fs = require('fs');
const path = require('path');

const specPath = path.join(__dirname, 'etapi.openapi.yaml');
let spec = null;

function register(router) {
    router.get('/etapi/etapi.openapi.yaml', (req, res, next) => {
        if (!spec) {
            spec = fs.readFileSync(specPath, 'utf8');
        }

        res.header('Content-Type', 'text/plain'); // so that it displays in browser
        res.status(200).send(spec);
    });
}

module.exports = {
    register
};
