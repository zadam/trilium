import { describe, expect, it } from "vitest";
import type { LlmPermissionRequest } from "@triliumnext/commons";

import { answerGoslingPermission, requestGoslingPermission } from "./gosling_permissions.js";

const request = {
    toolCall: { title: "Write synthetic note" },
    options: [
        { optionId: "once", kind: "allow_once", name: "Allow once" },
        { optionId: "always", kind: "allow_always", name: "Allow always" },
        { optionId: "deny", kind: "reject_once", name: "Deny" }
    ]
};

describe("Gosling permission broker", () => {
    it("scopes decisions to a single chat and never offers policy weakening", async () => {
        let displayed: LlmPermissionRequest | undefined;
        const controller = new AbortController();
        const outcome = requestGoslingPermission(
            request,
            "chat-a",
            (value) => {
                displayed = value;
            },
            controller.signal
        );
        expect(displayed?.options.map((option) => option.optionId)).toEqual(["once", "deny"]);
        const id = displayed?.requestId ?? "";
        expect(answerGoslingPermission("chat-b", id, "once")).toBe(false);
        expect(answerGoslingPermission("chat-a", id, "always")).toBe(false);
        expect(answerGoslingPermission("chat-a", id, "once")).toBe(true);
        expect(await outcome).toEqual({ outcome: { outcome: "selected", optionId: "once" } });
        expect(answerGoslingPermission("chat-a", id, "once")).toBe(false);
    });
    it("cancels pending approvals when the turn is revoked", async () => {
        const controller = new AbortController();
        const outcome = requestGoslingPermission(request, "chat", () => {}, controller.signal);
        controller.abort();
        expect(await outcome).toEqual({ outcome: { outcome: "cancelled" } });
    });
});
