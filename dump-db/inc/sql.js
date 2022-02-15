const Database = require("better-sqlite3");
let dbConnection;

const openDatabase = (documentPath) => { dbConnection = new Database(documentPath, { readonly: true }) };

const getRow = (query, params = []) => dbConnection.prepare(query).get(params);
const getRows = (query, params = []) => dbConnection.prepare(query).all(params);
const getValue = (query, params = []) => dbConnection.prepare(query).pluck().get(params);
const getColumn = (query, params = []) => dbConnection.prepare(query).pluck().all(params);

module.exports = {
    openDatabase,
    getRow,
    getRows,
    getValue,
    getColumn
};
