"use strict";

function reloadApp() {
    window.location.reload(true);
}

function showMessage(message) {
    console.log(now(), "message: ", message);

    $.notify({
        // options
        message: message
    },{
        // settings
        type: 'success',
        delay: 3000
    });
}

function showError(message, delay = 10000) {
    console.log(now(), "error: ", message);

    $.notify({
        // options
        message: message
    },{
        // settings
        type: 'danger',
        delay: delay
    });
}

function throwError(message) {
    messaging.logError(message);

    throw new Error(message);
}

function parseDate(str) {
    try {
        return new Date(Date.parse(str));
    }
    catch (e) {
        throw new Error("Can't parse date from " + str + ": " + e.stack);
    }
}

function padNum(num) {
    return (num <= 9 ? "0" : "") + num;
}

function formatTime(date) {
    return padNum(date.getHours()) + ":" + padNum(date.getMinutes());
}

function formatTimeWithSeconds(date) {
    return padNum(date.getHours()) + ":" + padNum(date.getMinutes()) + ":" + padNum(date.getSeconds());
}

function formatDate(date) {
    return padNum(date.getDate()) + ". " + padNum(date.getMonth() + 1) + ". " + date.getFullYear();
}

function formatDateISO(date) {
    return date.getFullYear() + "-" + padNum(date.getMonth() + 1) + "-" + padNum(date.getDate());
}

function formatDateTime(date) {
    return formatDate(date) + " " + formatTime(date);
}

function now() {
    return formatTimeWithSeconds(new Date());
}

function isElectron() {
    return window && window.process && window.process.type;
}

function assertArguments() {
    for (const i in arguments) {
        if (!arguments[i]) {
            throwError(`Argument idx#${i} should not be falsy: ${arguments[i]}`);
        }
    }
}

function assert(expr, message) {
    if (!expr) {
        throwError(message);
    }
}

function isTopLevelNode(node) {
    return isRootNode(node.getParent());
}

function isRootNode(node) {
    return node.key === "root_1";
}

function escapeHtml(str) {
    return $('<div/>').text(str).html();
}

async function stopWatch(what, func) {
    const start = new Date();

    const ret = await func();

    const tookMs = new Date().getTime() - start.getTime();

    console.log(`${what} took ${tookMs}ms`);

    return ret;
}

function executeScript(script) {
    // last \r\n is necessary if script contains line comment on its last line
    eval("(async function() {" + script + "\r\n})()");
}

function formatValueWithWhitespace(val) {
    return /\s/.test(val) ? '"' + val + '"' : val;
}

function formatAttribute(attr) {
    let str = "@" + formatValueWithWhitespace(attr.name);

    if (attr.value !== "") {
        str += "=" + formatValueWithWhitespace(attr.value);
    }

    return str;
}