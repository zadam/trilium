"use strict";

const anonymization = require('../../services/anonymization');

async function anonymize() {
    await anonymization.anonymize();
}

module.exports = {
    anonymize
};