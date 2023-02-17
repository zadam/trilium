const fs = require("fs");

const PACKAGE_JSON_PATH = './node_modules/pdfjs-dist/package.json';

const packageJson = JSON.parse(
    fs.readFileSync(PACKAGE_JSON_PATH).toString()
);

// non-legacy build doesn't work on node 16 at least
packageJson.main = "legacy/build/pdf.js";

fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2));