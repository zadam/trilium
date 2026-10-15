import type { Request } from "express";
import { ValidationError } from "@triliumnext/core";

export async function inventory(req: Request) {
    const { goslingProvider } = await import("../../services/llm/providers/gosling.js");
    return goslingProvider.inventory(req.body?.refresh === true);
}

export async function extensions() {
    const { goslingProvider, extensionName } =
        await import("../../services/llm/providers/gosling.js");
    return (await goslingProvider.extensions()).map((entry) => ({ name: extensionName(entry) }));
}

export async function revoke(req: Request) {
    const { chatNoteId } = req.body ?? {};
    if (typeof chatNoteId !== "string") {
        throw new ValidationError("chatNoteId is required");
    }
    const { goslingProvider } = await import("../../services/llm/providers/gosling.js");
    goslingProvider.revoke(chatNoteId);
}

export async function permission(req: Request) {
    const { chatNoteId, requestId, optionId } = req.body ?? {};
    if ([chatNoteId, requestId, optionId].some((value) => typeof value !== "string")) {
        throw new ValidationError("A chat, request and decision are required");
    }
    const { answerGoslingPermission } =
        await import("../../services/llm/providers/gosling_permissions.js");
    if (!answerGoslingPermission(chatNoteId, requestId, optionId)) {
        throw new ValidationError(
            "This approval request has expired or does not belong to this chat"
        );
    }
}
