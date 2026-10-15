import type { LlmModelInfo, LlmReasoningEffort } from "@triliumnext/commons";

export interface GoslingInventoryEntry {
    providerId: string;
    providerName: string;
    configured: boolean;
    defaultModel: string;
    stale: boolean;
    refreshing: boolean;
    lastRefreshError?: string;
    executesToolsOutsideGosling: boolean;
    endpointLocation?: "local" | "external" | "unknown";
    capabilities: {
        contextOwnership: string;
        nativeResume: string;
        inPlaceModelChange: string;
    };
    models: {
        id: string;
        name?: string;
        contextLimit?: number;
        recommended?: boolean;
        thinkingEfforts?: string[];
    }[];
}

/** JSON tuples preserve arbitrary provider/model identifiers without display-name parsing. */
export function goslingModelId(providerId: string, modelId: string): string {
    return JSON.stringify([providerId, modelId]);
}

export function parseGoslingModelId(value: string | undefined): [string, string] {
    try {
        const parsed: unknown = JSON.parse(value ?? "");
        if (
            Array.isArray(parsed) &&
            parsed.length === 2 &&
            parsed.every((item) => typeof item === "string" && item.length > 0)
        ) {
            return parsed as [string, string];
        }
    } catch {
        /* Invalid identities never select a default. */
    }
    throw new Error("Select a provider and model from Gosling's inventory.");
}

export function inventoryModels(
    entries: GoslingInventoryEntry[],
    expired = new Set<string>(),
    authenticationRequired = new Set<string>()
): LlmModelInfo[] {
    return entries.flatMap((entry) =>
        entry.models.map((model) => {
            const unavailableReason = !entry.configured
                ? "Not configured. Run gosling configure."
                : entry.executesToolsOutsideGosling
                  ? "This runtime executes tools outside Gosling; bounded note-chat permissions cannot be enforced."
                  : undefined;
            const reasoningEfforts = (model.thinkingEfforts ?? [])
                .map((effort) => (effort === "off" ? "none" : effort))
                .filter((effort): effort is LlmReasoningEffort =>
                    ["none", "low", "medium", "high", "max", "ultra"].includes(effort)
                );
            return {
                id: goslingModelId(entry.providerId, model.id),
                name: `${entry.providerName} / ${model.name || model.id}`,
                provider: "gosling",
                contextWindow: model.contextLimit,
                recommended: entry.configured && !unavailableReason && !!model.recommended,
                attachmentKinds: [],
                reasoningEfforts,
                gosling: {
                    providerId: entry.providerId,
                    modelId: model.id,
                    configured: entry.configured,
                    stale: entry.stale,
                    refreshing: entry.refreshing,
                    unavailableReason,
                    authenticationExpired: expired.has(entry.providerId),
                    authenticationRequired: authenticationRequired.has(entry.providerId),
                    endpointLocation: entry.endpointLocation ?? "unknown",
                    ...entry.capabilities
                }
            };
        })
    );
}
