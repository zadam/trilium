import { OptionRow } from "../becca/entities/rows";

/**
 * Response for /api/setup/status.
 */
export interface SetupStatusResponse {
    syncVersion: number;
    schemaExists: boolean;
}

/**
 * Response for /api/setup/sync-seed.
 */
export interface SetupSyncSeedResponse {
    syncVersion: number;
    options: OptionRow[]
}