import { Router } from "express";

import fs = require('fs');
import path = require('path');

const specPath = path.join(__dirname, 'etapi.openapi.yaml');
let spec: string | null = null;

function register(router: Router) {
    router.get('/etapi/etapi.openapi.yaml', (req, res, next) => {
        if (!spec) {
            spec = fs.readFileSync(specPath, 'utf8');
        }

        res.header('Content-Type', 'text/plain'); // so that it displays in browser
        res.status(200).send(spec);
    });
}

export = {
    register
};
