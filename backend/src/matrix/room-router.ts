import { MatrixGateway, MatrixRoomMessage } from "./gateway.js";
import { CommandParser } from "./commands.js";
import { EventFormatter } from "./formatter.js";
import { sessionService } from "../services/session.service.js";
import { eventBus } from "../shared/event-bus.js";
import { sessionRegistry } from "../shared/session-registry.js";

export class RoomRouter {
  private gateway: MatrixGateway;
  private commandParser: CommandParser;
  private formatter: EventFormatter;

  constructor(gateway: MatrixGateway) {
    this.gateway = gateway;
    this.commandParser = new CommandParser(gateway);
    this.formatter = new EventFormatter();
  }

  async handleMessage(msg: MatrixRoomMessage): Promise<void> {
    if (msg.isManagerRoom) {
      await this.handleManagerMessage(msg);
    } else if (msg.session) {
      await this.handleSessionMessage(msg);
    }
  }

  private async handleManagerMessage(msg: MatrixRoomMessage): Promise<void> {
    const result = await this.commandParser.parse(msg.body, msg.roomId, msg.sender);

    if (result.formattedReply) {
      await this.gateway.sendReply(msg.roomId, msg.eventId, result.reply, result.formattedReply);
    } else {
      await this.gateway.sendReply(msg.roomId, msg.eventId, result.reply);
    }
  }

  private async handleSessionMessage(msg: MatrixRoomMessage): Promise<void> {
    if (!msg.session) return;

    const body = msg.body.trim();

    // Check for permission responses
    if (/^(approve|allow|yes|y)$/i.test(body)) {
      await this.handlePermissionResponse(msg.session.id, "approved");
      return;
    }
    if (/^(deny|reject|no|n)$/i.test(body)) {
      await this.handlePermissionResponse(msg.session.id, "denied");
      return;
    }
    if (/^edit$/i.test(body)) {
      await this.gateway.sendReply(msg.roomId, msg.eventId, "Edit mode: send the modified JSON parameters.");
      return;
    }

    // Check for session commands
    if (body === "/cancel") {
      const handle = sessionService.getHandle(msg.session.id);
      if (handle) {
        await sessionService.cancelTurn(handle);
        await this.gateway.sendReply(msg.roomId, msg.eventId, "Prompt cancelled.");
      }
      return;
    }

    if (body === "/status") {
      const handle = sessionService.getHandle(msg.session.id);
      if (handle) {
        const status = await sessionService.getStatus(handle);
        await this.gateway.sendReply(msg.roomId, msg.eventId, `Session status: ${JSON.stringify(status)}`);
      }
      return;
    }

    // Regular prompt — forward to acpx
    await this.runTurnAndStream(msg);
  }

  private async runTurnAndStream(msg: MatrixRoomMessage): Promise<void> {
    const session = msg.session!;
    sessionRegistry.updateStatus(session.id, "running");

    const handle = await sessionService.ensureHandleForSession(session.id);
    const messageId = msg.eventId;

    // Send "thinking" indicator
    await this.gateway.sendReply(msg.roomId, messageId, "\u23F3 Processing...");

    let textBuffer = "";
    let eventCount = 0;
    const maxBufferedEvents = 20;

    try {
      for await (const event of sessionService.runTurn(handle, msg.body)) {
        eventCount++;
        const acpEvent = this.formatter.toAcpEvent(event, session.id);
        eventBus.emit(acpEvent);

        // Format and send to Matrix
        const formatted = this.formatter.toMatrixMessage(event);
        if (formatted) {
          if (event.type === "text_delta") {
            textBuffer += (event as any).text || "";
            if (eventCount % maxBufferedEvents === 0) {
              await this.gateway.sendReply(msg.roomId, messageId, textBuffer);
              textBuffer = "";
            }
          } else {
            if (textBuffer) {
              await this.gateway.sendReply(msg.roomId, messageId, textBuffer);
              textBuffer = "";
            }
            await this.gateway.sendReply(msg.roomId, messageId, formatted);
          }
        }
      }

      if (textBuffer) {
        await this.gateway.sendReply(msg.roomId, messageId, textBuffer);
      }

      sessionRegistry.updateStatus(session.id, "idle");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.gateway.sendReply(msg.roomId, messageId, `\u274C Error: ${errorMsg}`);
      sessionRegistry.updateStatus(session.id, "error");
    }
  }

  private async handlePermissionResponse(sessionId: string, decision: "approved" | "denied"): Promise<void> {
    console.log(`Permission ${decision} for session ${sessionId}`);
  }
}
