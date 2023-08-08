const scheduledExecutions = {};

/**
 * Subsequent calls will not move the timer to the future. The first caller determines the time of execution.
 *
 * The good thing about synchronous better-sqlite3 is that this cannot interrupt transaction. The execution will be called
 * only outside of a transaction.
 */
function scheduleExecution(name, milliseconds, cb) {
    if (name in scheduledExecutions) {
        return;
    }

    scheduledExecutions[name] = true;

    setTimeout(() => {
        delete scheduledExecutions[name];

        cb();
    }, milliseconds);
}

module.exports = {
    scheduleExecution
};
