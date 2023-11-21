import fs from 'fs';
import path from 'path';
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

export default {
    register
};
