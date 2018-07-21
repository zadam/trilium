"use strict";

const sqlInit = require('../../services/sql_init');

async function setup(req) {
    const { username, password } = req.body;

    await sqlInit.createInitialDatabase(username, password);
}

module.exports = {
    setup
};