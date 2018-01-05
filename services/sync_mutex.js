/**
 * Sync makes process can make data intermittently inconsistent. Processes which require strong data consistency
 * (like consistency checks) can use this mutex to make sure sync isn't currently running.
 */

const Mutex = require('async-mutex').Mutex;

module.exports = new Mutex();