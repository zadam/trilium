import { describe, expect, it } from "vitest";

import { goslingModelId, inventoryModels, parseGoslingModelId } from "./gosling_contract.js";

import { entry } from "./gosling_test_fixtures.js";

describe("Gosling inventory contract", () => {
    it("keeps identities exact across duplicate labels, custom providers and arbitrary separators", () => {
        const models = inventoryModels([
            entry("api/:a"),
            entry("subscription/:a"),
            entry("custom:one")
        ]);
        expect(new Set(models.map((model) => model.id)).size).toBe(3);
        expect(parseGoslingModelId(models[1].id)).toEqual([
            "subscription/:a",
            "model/:with separators"
        ]);
        expect(models[0].reasoningEfforts).toEqual(["none", "high", "ultra"]);
        expect(models.every((model) => model.attachmentKinds?.length === 0)).toBe(true);
    });
    it("reports configuration, expired authentication and provider-owned tool restrictions independently", () => {
        const models = inventoryModels(
            [
                entry("api", { configured: false }),
                entry("subscription"),
                entry("cli", { executesToolsOutsideGosling: true }),
                entry("custom", { stale: true, refreshing: true })
            ],
            new Set(["subscription"])
        );
        expect(
            [models[0], models[2]].every(
                (model) => !!model.gosling?.unavailableReason && !model.recommended
            )
        ).toBe(true);
        expect(models[1].gosling).toMatchObject({
            authenticationExpired: true,
            unavailableReason: undefined
        });
        expect(models[3].gosling).toMatchObject({
            stale: true,
            refreshing: true,
            unavailableReason: undefined
        });
        expect(models.every((model) => model.isSubscription === undefined)).toBe(true);
    });
    it("updates newly added and removed providers without a vendor catalog", () => {
        expect(inventoryModels([entry("new-provider")]).map((model) => model.id)).toEqual([
            goslingModelId("new-provider", "model/:with separators")
        ]);
        expect(inventoryModels([])).toEqual([]);
        expect(() => parseGoslingModelId("name / model")).toThrow();
    });
});
