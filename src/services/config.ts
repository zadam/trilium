"use strict";

import ini = require('ini');
import fs = require('fs');
import dataDir = require('./data_dir');
import path = require('path');
import resourceDir = require('./resource_dir');

const configSampleFilePath = path.resolve(resourceDir.RESOURCE_DIR, "config-sample.ini");

if (!fs.existsSync(dataDir.CONFIG_INI_PATH)) {
    const configSample = fs.readFileSync(configSampleFilePath).toString('utf8');

    fs.writeFileSync(dataDir.CONFIG_INI_PATH, configSample);
}

const config = ini.parse(fs.readFileSync(dataDir.CONFIG_INI_PATH, 'utf-8'));

export = config;
