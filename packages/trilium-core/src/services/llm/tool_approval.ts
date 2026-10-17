/**
 * The user's approval of the tool calls a chat turn makes.
 *
 * A turn holds its tool calls until the user answers them: `runChat()` opens a
 * {@link ToolApprovals} under the turn's stream id, the provider asks it about every
 * call through the AI SDK's `toolApproval` option, and the answer arrives through
 * `POST /api/llm-chat/tool-approval`, which looks the turn up by that id. Waiting
 * inside the turn keeps the conversation history free of tool calls, which the
 * client does not send back.
 */

import type { LlmToolApprovalRequest } from "@triliumnext/commons";

/** The reason the model is given for a call the user declined. */
export const TOOL_CALL_DECLINED_REASON = "The user declined this tool call.";

/** The tool calls of one turn that wait for the user's answer. */
export class ToolApprovals {
    private readonly pending = new Map<string, (approved: boolean) => void>();
    /** Called with every request, so the turn can pass it on to the client. */
    onRequest?: (request: LlmToolApprovalRequest) => void;

    constructor(private readonly abortSignal?: AbortSignal) {}

    /**
     * Ask the user about a tool call. Resolves to whether it was approved; a turn that
     * is stopped, or ends, before the user answers declines the call.
     */
    request(request: LlmToolApprovalRequest): Promise<boolean> {
        if (this.abortSignal?.aborted) {
            return Promise.resolve(false);
        }

        return new Promise((resolve) => {
            const settle = (approved: boolean) => {
                this.pending.delete(request.toolCallId);
                this.abortSignal?.removeEventListener("abort", onAbort);
                resolve(approved);
            };
            const onAbort = () => settle(false);
            this.abortSignal?.addEventListener("abort", onAbort, { once: true });
            this.pending.set(request.toolCallId, settle);
            this.onRequest?.(request);
        });
    }

    /** Settle a pending call. Returns `false` when no call with that id is waiting. */
    answer(toolCallId: string, approved: boolean): boolean {
        const settle = this.pending.get(toolCallId);
        settle?.(approved);
        return !!settle;
    }

    /** Decline every call that still waits. */
    declineAll(): void {
        for (const settle of [ ...this.pending.values() ]) {
            settle(false);
        }
    }
}

const openApprovals = new Map<string, ToolApprovals>();

/**
 * Open the approvals of a turn under its stream id. Returns `undefined` when a turn
 * with that id is already running.
 */
export function openToolApprovals(
    streamId: string,
    abortSignal?: AbortSignal
): ToolApprovals | undefined {
    if (openApprovals.has(streamId)) {
        return undefined;
    }
    const approvals = new ToolApprovals(abortSignal);
    openApprovals.set(streamId, approvals);
    return approvals;
}

/** Close the approvals of a finished turn, declining whatever still waits. */
export function closeToolApprovals(streamId: string): void {
    openApprovals.get(streamId)?.declineAll();
    openApprovals.delete(streamId);
}

/**
 * Pass on the user's answer to a tool call. Returns `false` when the turn has ended or
 * the call was already answered.
 */
export function answerToolApproval(
    streamId: string,
    toolCallId: string,
    approved: boolean
): boolean {
    return openApprovals.get(streamId)?.answer(toolCallId, approved) ?? false;
}
