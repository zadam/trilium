import build from "./build.js";
import packageJson from "../../package.json" with { type: "json" };
import { AppInfo } from "@triliumnext/commons";
import { getMaxMigrationVersion } from "../migrations/migrations.js";

// v41 requires a header-bound, sync-scoped session proof. Upgrade both peers together.
const SYNC_VERSION = 41;
const CLIPPER_PROTOCOL_VERSION = "1.1";

const appInfo: AppInfo = {
    appVersion: packageJson.version,
    dbVersion: getMaxMigrationVersion(),
    syncVersion: SYNC_VERSION,
    buildDate: build.buildDate,
    buildRevision: build.buildRevision,
    clipperProtocolVersion: CLIPPER_PROTOCOL_VERSION,
    utcDateTime: new Date().toISOString()
}

export default appInfo;
