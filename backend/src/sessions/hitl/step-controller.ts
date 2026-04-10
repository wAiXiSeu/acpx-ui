export type PreToolCallParams = {
  tool: string;
  params: Record<string, unknown>;
  callId: string;
};

export type PreToolCallResponse = {
  action: "continue" | "reject" | "modify";
  modifiedParams?: Record<string, unknown>;
};

type StepState = {
  enabled: boolean;
  pendingToolCall: PreToolCallParams | null;
  resolve: ((response: PreToolCallResponse) => void) | null;
};

export class StepController {
  private state: StepState = {
    enabled: false,
    pendingToolCall: null,
    resolve: null,
  };

  enable(): void {
    this.state.enabled = true;
  }

  disable(): void {
    this.state.enabled = false;
    if (this.state.resolve) {
      this.state.resolve({ action: "continue" });
      this.state.resolve = null;
      this.state.pendingToolCall = null;
    }
  }

  isEnabled(): boolean {
    return this.state.enabled;
  }

  async interceptToolCall(params: PreToolCallParams): Promise<PreToolCallResponse> {
    if (!this.state.enabled) {
      return { action: "continue" };
    }

    this.state.pendingToolCall = params;

    return new Promise<PreToolCallResponse>((resolve) => {
      this.state.resolve = resolve;
    });
  }

  approve(): void {
    if (this.state.resolve) {
      this.state.resolve({ action: "continue" });
      this.state.resolve = null;
      this.state.pendingToolCall = null;
    }
  }

  reject(): void {
    if (this.state.resolve) {
      this.state.resolve({ action: "reject" });
      this.state.resolve = null;
      this.state.pendingToolCall = null;
    }
  }

  applyModified(modifiedParams: Record<string, unknown>): void {
    if (this.state.resolve && this.state.pendingToolCall) {
      this.state.resolve({ action: "modify", modifiedParams });
      this.state.resolve = null;
      this.state.pendingToolCall = null;
    }
  }

  getPendingToolCall(): PreToolCallParams | null {
    return this.state.pendingToolCall;
  }
}
