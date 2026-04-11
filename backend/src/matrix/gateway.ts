import { createClient, MatrixClient, ClientEvent, EventType } from "matrix-js-sdk";
import { EventEmitter } from "node:events";

export interface MatrixGatewayConfig {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  managerRoomId: string;
  encryptionEnabled?: boolean;
}

export interface MatrixRoomMessage {
  roomId: string;
  session: import("../shared/types.js").SessionInfo | undefined;
  sender: string;
  body: string;
  eventId: string;
  isManagerRoom: boolean;
}

export class MatrixGateway extends EventEmitter {
  private client: MatrixClient | null = null;
  private config: MatrixGatewayConfig;

  constructor(config: MatrixGatewayConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    this.client = createClient({
      baseUrl: this.config.homeserverUrl,
      accessToken: this.config.accessToken,
      userId: this.config.userId,
    });

    this.setupEventListeners();

    await this.client.startClient({
      initialSyncLimit: 50,
    });

    this.emit("connected");
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on(ClientEvent.Event, async (event: any) => {
      if (event.getType() !== EventType.RoomMessage) return;
      if (event.getSender() === this.config.userId) return;

      const roomId = event.getRoomId();
      if (!roomId) return;

      const content = event.getContent();
      const body = content.body as string;
      const sender = event.getSender();

      // Import sessionRegistry here to avoid circular deps
      const { sessionRegistry } = await import("../shared/session-registry.js");
      const session = sessionRegistry.getByRoom(roomId);

      this.emit("room_message", {
        roomId,
        session,
        sender,
        body,
        eventId: event.getId(),
        isManagerRoom: roomId === this.config.managerRoomId,
      } as MatrixRoomMessage);
    });
  }

  async sendMessage(roomId: string, body: string, formattedBody?: string): Promise<string> {
    if (!this.client) throw new Error("Matrix client not connected");

    const content: Record<string, unknown> = {
      msgtype: "m.text",
      body,
    };

    if (formattedBody) {
      content.format = "org.matrix.custom.html";
      content.formatted_body = formattedBody;
    }

    const response = await this.client.sendEvent(roomId, "m.room.message" as any, content);
    return response.event_id;
  }

  async sendReply(roomId: string, replyToEventId: string, body: string, formattedBody?: string): Promise<string> {
    if (!this.client) throw new Error("Matrix client not connected");

    const content: Record<string, unknown> = {
      "m.relates_to": {
        "m.in_reply_to": { event_id: replyToEventId },
      },
      msgtype: "m.text",
      body,
    };

    if (formattedBody) {
      content.format = "org.matrix.custom.html";
      content.formatted_body = formattedBody;
    }

    const response = await this.client.sendEvent(roomId, "m.room.message" as any, content);
    return response.event_id;
  }

  async createRoom(name: string, inviterUserId: string, topic?: string): Promise<string> {
    if (!this.client) throw new Error("Matrix client not connected");

    const response = await this.client.createRoom({
      name,
      topic,
      preset: "trusted_private_chat" as any,
      invite: [inviterUserId],
      initial_state: this.config.encryptionEnabled
        ? [{ type: "m.room.encryption", state_key: "", content: { algorithm: "m.megolm.v1.aes-sha2" } }]
        : [],
    });

    return response.room_id;
  }

  async getMatrixEventLink(roomId: string): Promise<string> {
    return `https://matrix.to/#/${roomId}`;
  }

  isConnected(): boolean {
    return this.client !== null && this.client.isInitialSyncComplete();
  }

  getConnectedRooms(): number {
    if (!this.client) return 0;
    return this.client.getRooms().length;
  }

  disconnect(): Promise<void> {
    if (this.client) {
      this.client.stopClient();
    }
    return Promise.resolve();
  }
}
