import { sessionService } from "../services/session.service.js";
import { sessionRegistry } from "../shared/session-registry.js";
import type { MatrixGateway } from "./gateway.js";
import type { SessionInfo } from "../shared/types.js";

export type CommandResult = {
  reply: string;
  formattedReply?: string;
};

export class CommandParser {
  private gateway: MatrixGateway;

  constructor(gateway: MatrixGateway) {
    this.gateway = gateway;
  }

  async parse(body: string, roomId: string, sender: string): Promise<CommandResult> {
    const trimmed = body.trim();
    if (!trimmed.startsWith("/")) {
      return { reply: "Unknown command. Type `/help` for available commands." };
    }

    const [command, ...args] = trimmed.slice(1).split(/\s+/);

    switch (command.toLowerCase()) {
      case "new":
        return await this.handleNew(args, roomId, sender);
      case "list":
        return this.handleList();
      case "kill":
        return await this.handleKill(args);
      case "use":
        return this.handleUse(args);
      case "mode":
        return this.handleMode(args);
      case "step":
        return this.handleStep(args);
      case "intercept":
        return this.handleIntercept(args);
      case "help":
        return this.handleHelp();
      default:
        return { reply: `Unknown command: /${command}. Type \`/help\` for available commands.` };
    }
  }

  private async handleNew(args: string[], _roomId: string, sender: string): Promise<CommandResult> {
    if (args.length === 0) {
      return { reply: "Usage: `/new <agent> [name]`\nExample: `/new claude refactor auth module`" };
    }

    const agent = args[0].toLowerCase();
    const name = args.slice(1).join(" ") || `session-${Date.now()}`;

    // Create session via SessionService
    const result = await sessionService.createSession({ agent, name });
    const sessionId = result.record.acpxRecordId || name;

    // Create Matrix room for this session
    const roomName = name;
    const topic = `Agent: ${agent} | Created: ${new Date().toISOString()}`;
    const room = await this.gateway.createRoom(roomName, sender, topic);

    // Register in registry
    sessionRegistry.register({
      id: sessionId,
      room,
      name,
      agent,
      status: "idle",
      hitlMode: "off",
      permissionMode: "approve-reads",
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      tokenUsage: { prompt: 0, completion: 0 },
    });

    const roomLink = await this.gateway.getMatrixEventLink(room);
    return {
      reply: `Session "${name}" created with agent \`${agent}\`.\nJoin: ${roomLink}`,
      formattedReply: `Session "<strong>${name}</strong>" created with agent <code>${agent}</code>.<br><a href="${roomLink}">Join session room</a>`,
    };
  }

  private handleList(): CommandResult {
    const sessions = sessionRegistry.getAll();
    if (sessions.length === 0) {
      return { reply: "No active sessions." };
    }

    const lines = sessions.map((s) => {
      const statusIcon = s.status === "running" ? "\u{1F7E2}" : s.status === "error" ? "\u{1F534}" : "\u26AA";
      return `${statusIcon} \`${s.id.slice(0, 8)}\` **${s.name}** — ${s.agent} (${s.status})`;
    });

    const htmlList = sessions.map((s) => {
      const statusIcon = s.status === "running" ? "\u{1F7E2}" : s.status === "error" ? "\u{1F534}" : "\u26AA";
      return `<li>${statusIcon} <code>${s.id.slice(0, 8)}</code> <strong>${s.name}</strong> — ${s.agent} (${s.status})</li>`;
    }).join("");

    return {
      reply: `Active sessions:\n\n${lines.join("\n")}`,
      formattedReply: `<p>Active sessions:</p><ul>${htmlList}</ul>`,
    };
  }

  private async handleKill(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return { reply: "Usage: `/kill <session-id|name>`" };
    }

    const query = args[0];
    let session = sessionRegistry.getById(query);
    if (!session) {
      session = sessionRegistry.getAll().find((s) => s.name === query || s.id.startsWith(query));
    }

    if (!session) {
      return { reply: `Session not found: \`${query}\`` };
    }

    try {
      await sessionService.closeSession(session.id);
      sessionRegistry.unregister(session.id);
      return { reply: `Session "${session.name}" terminated.` };
    } catch (error) {
      return { reply: `Failed to kill session: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private handleUse(args: string[]): CommandResult {
    if (args.length === 0) {
      return { reply: "Usage: `/use <agent>`\nSets the default agent for new sessions." };
    }
    return { reply: `Default agent set to \`${args[0]}\`.` };
  }

  private handleMode(args: string[]): CommandResult {
    const validModes = ["approve-all", "approve-reads", "deny-all"];
    if (args.length === 0) {
      return { reply: `Usage: \`/mode <${validModes.join("|")}>\`` };
    }

    const mode = args[0] as SessionInfo["permissionMode"];
    if (!validModes.includes(mode)) {
      return { reply: `Invalid mode. Valid modes: ${validModes.join(", ")}` };
    }

    return { reply: `Permission mode set to \`${mode}\`.` };
  }

  private handleStep(args: string[]): CommandResult {
    if (args.length === 0) {
      return { reply: "Usage: `/step on|off`" };
    }

    const action = args[0].toLowerCase();
    if (action === "on") {
      return { reply: "Step mode enabled. Each tool call will require approval." };
    }
    if (action === "off") {
      return { reply: "Step mode disabled." };
    }
    return { reply: "Usage: `/step on|off`" };
  }

  private handleIntercept(args: string[]): CommandResult {
    if (args.length === 0) {
      return { reply: "Usage: `/intercept <message>`" };
    }
    const message = args.join(" ");
    return { reply: `Intercept message queued: "${message}"` };
  }

  private handleHelp(): CommandResult {
    return {
      reply: [
        "**Available commands:**",
        "",
        "`/new <agent> [name]` — Create a new session",
        "`/list` — List all active sessions",
        "`/kill <session>` — Terminate a sessions",
        "`/use <agent>` — Set default agent",
        "`/mode <mode>` — Set permission mode",
        "`/step on|off` — Toggle step mode",
        "`/intercept <msg>` — Send correction to running session",
        "`/help` — Show this help",
      ].join("\n"),
      formattedReply: [
        "<p><strong>Available commands:</strong></p>",
        "<ul>",
        "<li><code>/new &lt;agent&gt; [name]</code> — Create a new session</li>",
        "<li><code>/list</code> — List all active sessions</li>",
        "<li><code>/kill &lt;session&gt;</code> — Terminate a sessions</li>",
        "<li><code>/use &lt;agent&gt;</code> — Set default agent</li>",
        "<li><code>/mode &lt;mode&gt;</code> — Set permission mode</li>",
        "<li><code>/step on|off</code> — Toggle step mode</li>",
        "<li><code>/intercept &lt;msg&gt;</code> — Send correction to running session</li>",
        "<li><code>/help</code> — Show this help</li>",
        "</ul>",
      ].join(""),
    };
  }
}
