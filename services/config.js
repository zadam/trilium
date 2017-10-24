"use strict";

const ini = require('ini');
const fs = require('fs');
const dataDir = require('./data_dir');

const config = ini.parse(fs.readFileSync(dataDir.TRILIUM_DATA_DIR + '/config.ini', 'utf-8'));

module.exports = config;