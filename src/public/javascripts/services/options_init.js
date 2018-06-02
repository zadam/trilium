import server from "./server.js";

const optionsReady = new Promise((resolve, reject) => {
    $(document).ready(() => server.get('options').then(resolve));
});

export default {
    optionsReady
}