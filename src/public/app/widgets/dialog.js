import appContext from "../services/app_context.js";

async function info(message) {
    return new Promise(res =>
        appContext.triggerCommand("showInfoDialog", {message, callback: res}));
}

async function confirm(message) {
    return new Promise(res =>
        appContext.triggerCommand("showConfirmDialog", {message, callback: res}));
}

export default {
    info,
    confirm
};
