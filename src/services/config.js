"use strict";

const ini = require('ini');
const fs = require('fs');
const dataDir = require('./data_dir');
const path = require('path');
const resourceDir = require('./resource_dir');

const configSampleFilePath = path.resolve(resourceDir.RESOURCE_DIR, "config-sample.ini");

const configFilePath = dataDir.TRILIUM_DATA_DIR + '/config.ini';

if (!fs.existsSync(configFilePath)) {
    const configSample = fs.readFileSync(configSampleFilePath).toString('utf8');

    fs.writeFileSync(configFilePath, configSample);
}

const config = ini.parse(fs.readFileSync(configFilePath, 'utf-8'));

module.exports = config;