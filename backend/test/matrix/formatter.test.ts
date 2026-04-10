import { describe, it, expect } from "vitest";
import { EventFormatter } from "../../src/matrix/formatter.js";

describe("EventFormatter", () => {
  const formatter = new EventFormatter();

  it("formats text_delta as plain text", () => {
    const result = formatter.toMatrixMessage({ type: "text_delta", text: "Hello world" });
    expect(result).toBe("Hello world");
  });

  it("formats tool_call start", () => {
    const result = formatter.toMatrixMessage({
      type: "tool_call",
      title: "writeFile",
      text: "writeFile(\"config.json\")",
      status: "start",
    });
    expect(result).toBe("\U0001F527 Calling: writeFile");
  });

  it("formats tool_call success", () => {
    const result = formatter.toMatrixMessage({
      type: "tool_call",
      title: "writeFile",
      text: "done",
      status: "success",
    });
    expect(result).toBe("\u2705 writeFile completed");
  });

  it("formats tool_call error", () => {
    const result = formatter.toMatrixMessage({
      type: "tool_call",
      title: "writeFile",
      text: "permission denied",
      status: "error",
    });
    expect(result).toBe("\u274C writeFile failed: permission denied");
  });

  it("formats done event", () => {
    const result = formatter.toMatrixMessage({ type: "done", stopReason: "end_turn" });
    expect(result).toBe("\u2713 Completed (end_turn)");
  });

  it("formats error event", () => {
    const result = formatter.toMatrixMessage({ type: "error", message: "Something broke" });
    expect(result).toBe("\u274C Error: Something broke");
  });

  it("formats permission request", () => {
    const result = formatter.formatPermissionRequest("writeFile", "Write to config.json");
    expect(result).toContain("Permission");
    expect(result).toContain("APPROVE");
    expect(result).toContain("DENY");
  });

  it("formats edit prompt with JSON", () => {
    const result = formatter.formatEditPrompt({ path: "config.json", content: "test" });
    expect(result).toContain("\u270F\uFE0F");
    expect(result).toContain("config.json");
    expect(result).toContain("```json");
  });

  it("returns null for unknown tool_call status", () => {
    const result = formatter.toMatrixMessage({
      type: "tool_call",
      title: "test",
      text: "test",
      status: "unknown_status",
    } as any);
    expect(result).toBeNull();
  });
});
