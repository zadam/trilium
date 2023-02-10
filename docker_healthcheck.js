const http = require("http");
const config = require("./src/services/config");

if (config.https) {
    // built-in TLS (terminated by trilium) is not supported yet, PRs are welcome
    // for reverse proxy terminated TLS this will works since config.https will be false
    process.exit(0);
    return;
}

const port = require('./src/services/port');
const host = require('./src/services/host');
const url = `http://${host}:${port}/api/health-check`;
const options = { timeout: 2000 };
const request = http.request(url, options, res => {
    console.log(`STATUS: ${res.statusCode}`);
    if (res.statusCode === 200) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});
request.on("error", err => {
    console.log("ERROR");
    process.exit(1);
});
request.end();