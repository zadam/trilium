"use strict";

class Entity {
    constructor(sql, row) {
        this.sql = sql;

        for (const key in row) {
            this[key] = row[key];
        }
    }
}

module.exports = Entity;