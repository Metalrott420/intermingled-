import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "http";
import { io as clientIo, type Socket as ClientSocket } from "socket.io-client";

const {
  mockVerifyToken,
  mockMatchFindFirst,
  mockUsersWhere,
  clerkSubState,
} = vi.hoisted(() => ({
  mockVerifyToken: vi.fn(),
  mockMatchFindFirst: vi.fn(),
  mockUsersWhere: vi.fn(),
  clerkSubState: { value: "" },
}));

vi.mock("@workspace/db", () => {
  const usersTable = { id: "id", clerkId: "clerkId" };
  const matchesTable = { id: "id", chooserUserId: "chooserUserId", suitorUserId: "suitorUserId" };

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockUsersWhere,
      })),
    })),
    query: {
      matchesTable: { findFirst: mockMatchFindFirst },
      participantsTable: { findFirst: vi.fn() },
    },
  };

  return {
    db,
    usersTable,
    matchesTable,
    participantsTable: { id: "id", roomId: "roomId" },
  };
});

vi.mock("@clerk/express", () => ({
  verifyToken: mockVerifyToken,
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../services/analyticsService.js", () => ({
  trackGameplayEvent: vi.fn(),
}));

import { getMatchPresenceSnapshot, initSocket } from "../../../socket.js";

const MATCH_ID = "match-1";

async function createSocketStack() {
  const httpServer = createServer();
  const io = initSocket(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => resolve());
  });

  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Failed to bind test server");
  const origin = `http://127.0.0.1:${address.port}`;

  async function newClient() {
    const socket = clientIo(origin, {
      path: "/ws/socket.io",
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("connect_error", reject);
    });

    return socket;
  }

  async function shutdown(clientSockets: ClientSocket[]) {
    for (const socket of clientSockets) {
      if (socket.connected) socket.disconnect();
    }

    await new Promise<void>((resolve) => {
      try {
        io.close(() => resolve());
      } catch {
        resolve();
      }
    });

    await new Promise<void>((resolve) => {
      try {
        httpServer.close(() => resolve());
      } catch {
        resolve();
      }
    });
  }

  return { newClient, shutdown };
}

describe("DM socket lifecycle integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clerkSubState.value = "";

    mockVerifyToken.mockImplementation(async (token: string) => {
      if (token === "token-1") {
        clerkSubState.value = "clerk-1";
        return { sub: "clerk-1" };
      }
      if (token === "token-2") {
        clerkSubState.value = "clerk-2";
        return { sub: "clerk-2" };
      }
      throw new Error("invalid token");
    });

    mockUsersWhere.mockImplementation(async () => {
      if (clerkSubState.value === "clerk-1") return [{ id: "db-user-1" }];
      if (clerkSubState.value === "clerk-2") return [{ id: "db-user-2" }];
      return [];
    });

    mockMatchFindFirst.mockResolvedValue({
      id: MATCH_ID,
      chooserUserId: "db-user-1",
      suitorUserId: "db-user-2",
    });
  });

  afterEach(() => {
    delete process.env.CLERK_SECRET_KEY;
  });

  it("join_match emits presence online", async () => {
    process.env.CLERK_SECRET_KEY = "test-secret";
    const stack = await createSocketStack();
    const clients: ClientSocket[] = [];

    try {
      const client = await stack.newClient();
      clients.push(client);

      const presence = await new Promise<any>((resolve) => {
        client.once("presence", resolve);
        client.emit("join_match", { matchId: MATCH_ID, token: "token-1" });
      });

      expect(presence).toMatchObject({
        matchId: MATCH_ID,
        userId: "db-user-1",
        online: true,
      });
    } finally {
      await stack.shutdown(clients);
    }
  });

  it("typing relays to the other matched user", async () => {
    process.env.CLERK_SECRET_KEY = "test-secret";
    const stack = await createSocketStack();
    const clients: ClientSocket[] = [];

    try {
      const user1 = await stack.newClient();
      const user2 = await stack.newClient();
      clients.push(user1, user2);

      await new Promise<void>((resolve) => {
        user1.once("presence", () => resolve());
        user1.emit("join_match", { matchId: MATCH_ID, token: "token-1" });
      });

      await new Promise<void>((resolve) => {
        user2.once("presence", () => resolve());
        user2.emit("join_match", { matchId: MATCH_ID, token: "token-2" });
      });

      const typing = await new Promise<any>((resolve) => {
        user2.once("typing", resolve);
        user1.emit("typing", { matchId: MATCH_ID });
      });

      expect(typing).toMatchObject({
        matchId: MATCH_ID,
        userId: "db-user-1",
      });
    } finally {
      await stack.shutdown(clients);
    }
  });

  it("disconnect emits presence offline and clears stale typing state", async () => {
    process.env.CLERK_SECRET_KEY = "test-secret";
    const stack = await createSocketStack();
    const clients: ClientSocket[] = [];

    try {
      const user1 = await stack.newClient();
      const user2 = await stack.newClient();
      clients.push(user1, user2);

      await new Promise<void>((resolve) => {
        user1.once("presence", () => resolve());
        user1.emit("join_match", { matchId: MATCH_ID, token: "token-1" });
      });

      await new Promise<void>((resolve) => {
        user2.once("presence", () => resolve());
        user2.emit("join_match", { matchId: MATCH_ID, token: "token-2" });
      });

      await new Promise<void>((resolve) => {
        user2.once("typing", () => resolve());
        user1.emit("typing", { matchId: MATCH_ID });
      });

      const offlinePresence = new Promise<any>((resolve) => {
        user2.once("presence", (payload) => {
          if (payload.online === false) resolve(payload);
        });
      });

      user1.disconnect();

      const offline = await offlinePresence;
      expect(offline).toMatchObject({
        matchId: MATCH_ID,
        userId: "db-user-1",
        online: false,
      });

      const snapshot = getMatchPresenceSnapshot(MATCH_ID, "db-user-2");
      expect(snapshot.otherOnline).toBe(false);
      expect(snapshot.isOtherTyping).toBe(false);
      expect(snapshot.lastTypingAt).toBeNull();
    } finally {
      await stack.shutdown(clients);
    }
  });
});
