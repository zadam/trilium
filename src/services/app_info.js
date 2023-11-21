import build from './build.js'
import packageJson from '../../package.json' assert { type: 'json' }
import dataDir from './data_dir.js';

const APP_DB_VERSION = 227;
const SYNC_VERSION = 31;
const CLIPPER_PROTOCOL_VERSION = "1.0";

export default {
    appVersion: packageJson.version,
    dbVersion: APP_DB_VERSION,
    syncVersion: SYNC_VERSION,
    buildDate: build.buildDate,
    buildRevision: build.buildRevision,
    dataDirectory: dataDir.TRILIUM_DATA_DIR,
    clipperProtocolVersion: CLIPPER_PROTOCOL_VERSION,
    utcDateTime: new Date().toISOString() // for timezone inference
};
