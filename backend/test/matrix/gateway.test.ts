import { describe, it, expect, vi, beforeEach } from "vitest";
import { MatrixGateway } from "../../src/matrix/gateway.js";

vi.mock("matrix-js-sdk", () => ({
  createClient: vi.fn(() => ({
    startClient: vi.fn().mockResolvedValue(undefined),
    isInitialSyncComplete: vi.fn().mockReturnValue(true),
    getRooms: vi.fn().mockReturnValue([]),
    on: vi.fn(),
    stopClient: vi.fn(),
  })),
  RoomEvent: { Timeline: "Room.timeline" },
}));

describe("MatrixGateway", () => {
  let gateway: MatrixGateway;

  beforeEach(() => {
    gateway = new MatrixGateway({
      homeserverUrl: "http://localhost:8008",
      accessToken: "test-token",
      userId: "@acpx:test.server",
      managerRoomId: "!manager:room",
    });
  });

  it("connects successfully", async () => {
    await gateway.connect();
    expect(gateway.isConnected()).toBe(true);
  });

  it("reports disconnected state", () => {
    expect(gateway.isConnected()).toBe(false);
  });

  it("throws when sending without connection", async () => {
    await expect(gateway.sendMessage("!room:id", "hello")).rejects.toThrow("not connected");
  });

  it("reports zero rooms when disconnected", () => {
    expect(gateway.getConnectedRooms()).toBe(0);
  });
});
