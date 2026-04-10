export class ParamEditor {
  static parseEditResponse(body: string): Record<string, unknown> | null {
    const trimmed = body.trim();

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  static formatToolParamsForEdit(tool: string, params: Record<string, unknown>): string {
    return `✏️ Edit the parameters for \`${tool}\` and send back the modified JSON:\n\`\`\`json\n${JSON.stringify(params, null, 2)}\n\`\`\``;
  }

  static validateEditResponse(body: string): { valid: boolean; params?: Record<string, unknown>; error?: string } {
    const parsed = this.parseEditResponse(body);
    if (!parsed) {
      return { valid: false, error: "Invalid JSON. Please send a valid JSON object." };
    }
    return { valid: true, params: parsed };
  }
}
