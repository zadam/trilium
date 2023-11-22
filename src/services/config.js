"use strict";

const ini = require('ini');
const fs = require('fs');
const dataDir = require('./data_dir.js');
const path = require('path');
const resourceDir = require('./resource_dir.js');

const configSampleFilePath = path.resolve(resourceDir.RESOURCE_DIR, "config-sample.ini");

if (!fs.existsSync(dataDir.CONFIG_INI_PATH)) {
    const configSample = fs.readFileSync(configSampleFilePath).toString('utf8');

    fs.writeFileSync(dataDir.CONFIG_INI_PATH, configSample);
}

const config = ini.parse(fs.readFileSync(dataDir.CONFIG_INI_PATH, 'utf-8'));

module.exports = config;
