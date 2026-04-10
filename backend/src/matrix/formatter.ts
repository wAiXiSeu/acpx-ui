import type { AcpRuntimeEvent } from "@local/acpx/runtime";
import type { AcpEvent } from "../shared/types.js";

export class EventFormatter {
  toMatrixMessage(event: AcpRuntimeEvent): string | null {
    switch (event.type) {
      case "text_delta":
        return event.text;

      case "tool_call":
        if (event.status === "start" || !event.status) {
          return `\U0001F527 Calling: ${event.title || event.text}`;
        }
        if (event.status === "success") {
          return `\u2705 ${event.title || event.text} completed`;
        }
        if (event.status === "error") {
          return `\u274C ${event.title || event.text} failed: ${event.text}`;
        }
        return null;

      case "status":
        return `\U0001F4CA ${event.text}`;

      case "done":
        return `\u2713 Completed${event.stopReason ? ` (${event.stopReason})` : ""}`;

      case "error":
        return `\u274C Error: ${event.message}`;

      default:
        return null;
    }
  }

  toAcpEvent(event: AcpRuntimeEvent, sessionId: string): AcpEvent {
    return {
      type: event.type as AcpEvent["type"],
      sessionId,
      timestamp: Date.now(),
      payload: event as Record<string, unknown>,
    };
  }

  formatPermissionRequest(toolName: string, description: string): string {
    return `[Permission] ${description} for ${toolName}? Reply APPROVE or DENY`;
  }

  formatEditPrompt(params: Record<string, unknown>): string {
    return `\u270F\uFE0F Edit the parameters and send back:\n\`\`\`json\n${JSON.stringify(params, null, 2)}\n\`\`\``;
  }
}
