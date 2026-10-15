import type { LlmPermissionRequest } from "@triliumnext/commons";
import { randomUUID } from "node:crypto";

import type { AcpPermissionOutcome, AcpPermissionRequest } from "./acp_agent.js";

const pending = new Map<
    string,
    {
        chatNoteId: string;
        options: LlmPermissionRequest["options"];
        finish: (optionId?: string) => void;
    }
>();

/** A decision is valid for one outstanding request in one chat, and never changes global policy. */
export function requestGoslingPermission(
    request: AcpPermissionRequest,
    chatNoteId: string,
    emit: (request: LlmPermissionRequest) => void,
    signal: AbortSignal
): Promise<AcpPermissionOutcome> {
    const options = (request.options ?? [])
        .filter((option) => option.kind === "allow_once" || option.kind === "reject_once")
        .map((option) => ({
            optionId: option.optionId,
            name: option.name ?? option.kind ?? "",
            kind: option.kind ?? ""
        }));
    if (signal.aborted || !options.length) {
        return Promise.resolve({ outcome: { outcome: "cancelled" } });
    }
    return new Promise((resolve) => {
        const requestId = randomUUID();
        const finish = (optionId?: string) => {
            clearTimeout(timer);
            signal.removeEventListener("abort", abort);
            pending.delete(requestId);
            resolve({
                outcome: optionId ? { outcome: "selected", optionId } : { outcome: "cancelled" }
            });
        };
        const abort = () => finish();
        const timer = setTimeout(abort, 5 * 60_000);
        timer.unref();
        signal.addEventListener("abort", abort, { once: true });
        pending.set(requestId, { chatNoteId, options, finish });
        emit({
            requestId,
            chatNoteId,
            title: request.toolCall?.title ?? "Gosling tool request",
            input: JSON.stringify(request.toolCall?.rawInput ?? {}, null, 2),
            options
        });
    });
}

export function answerGoslingPermission(
    chatNoteId: string,
    requestId: string,
    optionId: string
): boolean {
    const request = pending.get(requestId);
    if (
        !request ||
        request.chatNoteId !== chatNoteId ||
        !request.options.some((option) => option.optionId === optionId)
    ) {
        return false;
    }
    request.finish(optionId);
    return true;
}
