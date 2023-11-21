import ini from 'ini';
import fs from 'fs';
import dataDir from './data_dir.js'
import path from 'path';
import resourceDir from './resource_dir.js'

const configSampleFilePath = path.resolve(resourceDir.RESOURCE_DIR, "config-sample.ini");

if (!fs.existsSync(dataDir.CONFIG_INI_PATH)) {
    const configSample = fs.readFileSync(configSampleFilePath).toString('utf8');

    fs.writeFileSync(dataDir.CONFIG_INI_PATH, configSample);
}

const config = ini.parse(fs.readFileSync(dataDir.CONFIG_INI_PATH, 'utf-8'));

export default config;
