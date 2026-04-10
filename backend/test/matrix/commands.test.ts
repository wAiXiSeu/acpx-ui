import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandParser } from "../../src/matrix/commands.js";
import { sessionRegistry } from "../../src/shared/session-registry.js";

vi.mock("../../src/services/session.service.js", () => ({
  sessionService: {
    createSession: vi.fn().mockResolvedValue({
      record: { acpxRecordId: "test-session-id" },
      handle: {},
    }),
    closeSession: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../src/shared/session-registry.js", () => ({
  sessionRegistry: {
    register: vi.fn(),
    unregister: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
    getById: vi.fn(),
  },
}));

describe("CommandParser", () => {
  let parser: CommandParser;

  beforeEach(() => {
    const mockGateway = {
      createRoom: vi.fn().mockResolvedValue("!newroom:server"),
      getMatrixEventLink: vi.fn().mockResolvedValue("https://matrix.to/#!/!newroom:server"),
    };
    parser = new CommandParser(mockGateway as any);
    vi.clearAllMocks();
  });

  it("returns unknown command for non-slash input", async () => {
    const result = await parser.parse("hello world", "!room:id", "@user:server");
    expect(result.reply).toContain("Unknown command");
  });

  it("returns help for unknown slash command", async () => {
    const result = await parser.parse("/foo", "!room:id", "@user:server");
    expect(result.reply).toContain("Unknown command: /foo");
  });

  it("/new requires agent name", async () => {
    const result = await parser.parse("/new", "!room:id", "@user:server");
    expect(result.reply).toContain("Usage");
  });

  it("/list returns empty message when no sessions", async () => {
    const result = await parser.parse("/list", "!room:id", "@user:server");
    expect(result.reply).toContain("No active sessions");
  });

  it("/kill requires session ID", async () => {
    const result = await parser.parse("/kill", "!room:id", "@user:server");
    expect(result.reply).toContain("Usage");
  });

  it("/kill returns not found for unknown session", async () => {
    vi.mocked(sessionRegistry.getById).mockReturnValue(undefined);
    vi.mocked(sessionRegistry.getAll).mockReturnValue([]);
    const result = await parser.parse("/kill unknown", "!room:id", "@user:server");
    expect(result.reply).toContain("not found");
  });

  it("/help lists all commands", async () => {
    const result = await parser.parse("/help", "!room:id", "@user:server");
    expect(result.reply).toContain("/new");
    expect(result.reply).toContain("/list");
    expect(result.reply).toContain("/kill");
  });

  it("/step on returns enable message", async () => {
    const result = await parser.parse("/step on", "!room:id", "@user:server");
    expect(result.reply).toContain("enabled");
  });

  it("/step off returns disable message", async () => {
    const result = await parser.parse("/step off", "!room:id", "@user:server");
    expect(result.reply).toContain("disabled");
  });

  it("/mode validates valid modes", async () => {
    const result = await parser.parse("/mode approve-reads", "!room:id", "@user:server");
    expect(result.reply).toContain("approve-reads");
  });

  it("/mode rejects invalid mode", async () => {
    const result = await parser.parse("/mode invalid", "!room:id", "@user:server");
    expect(result.reply).toContain("Invalid mode");
  });
});
