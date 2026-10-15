import type { GoslingInventoryEntry } from "./gosling_contract.js";

export function entry(
    id: string,
    overrides: Partial<GoslingInventoryEntry> = {}
): GoslingInventoryEntry {
    return {
        providerId: id,
        providerName: "Same display name",
        configured: true,
        defaultModel: "model/:with separators",
        stale: false,
        refreshing: false,
        executesToolsOutsideGosling: false,
        endpointLocation: "local",
        capabilities: {
            contextOwnership: "gosling",
            nativeResume: "supported",
            inPlaceModelChange: "unsupported"
        },
        models: [
            {
                id: "model/:with separators",
                recommended: true,
                thinkingEfforts: ["off", "high", "ultra"]
            }
        ],
        ...overrides
    };
}
