import { describe, it, expect, vi } from "vitest";
import { createSessionManager, hashContent } from "../src/session.js";

describe("hashContent", () => {
  it("returns consistent hash for same content", () => {
    expect(hashContent("hello")).toBe(hashContent("hello"));
  });

  it("returns different hash for different content", () => {
    expect(hashContent("hello")).not.toBe(hashContent("world"));
  });
});

describe("createSessionManager", () => {
  it("creates a new session via factory", async () => {
    const dispose = vi.fn();
    const mgr = createSessionManager<string>({ dispose });
    const session = await mgr.getOrCreate("key1", "hash1", async () => "session1");
    expect(session).toBe("session1");
  });

  it("reuses session for same key and hash", async () => {
    const factory = vi.fn(async () => "session1");
    const mgr = createSessionManager<string>();
    await mgr.getOrCreate("key1", "hash1", factory);
    const session = await mgr.getOrCreate("key1", "hash1", factory);
    expect(session).toBe("session1");
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("recreates session when hash changes", async () => {
    const dispose = vi.fn();
    const mgr = createSessionManager<string>({ dispose });
    await mgr.getOrCreate("key1", "hash1", async () => "v1");
    const session = await mgr.getOrCreate("key1", "hash2", async () => "v2");
    expect(session).toBe("v2");
    expect(dispose).toHaveBeenCalledWith("v1");
  });

  it("evicts oldest when at capacity", async () => {
    const dispose = vi.fn();
    const mgr = createSessionManager<string>({ maxSessions: 2, dispose });
    await mgr.getOrCreate("a", "h", async () => "sa");
    await mgr.getOrCreate("b", "h", async () => "sb");
    await mgr.getOrCreate("c", "h", async () => "sc");
    expect(dispose).toHaveBeenCalledWith("sa");
    expect(mgr.listSessions()).toEqual(["b", "c"]);
  });

  it("get returns undefined for missing key", () => {
    const mgr = createSessionManager<string>();
    expect(mgr.get("missing")).toBeUndefined();
  });

  it("clear disposes and removes session", async () => {
    const dispose = vi.fn();
    const mgr = createSessionManager<string>({ dispose });
    await mgr.getOrCreate("key1", "hash1", async () => "s1");
    mgr.clear("key1");
    expect(dispose).toHaveBeenCalledWith("s1");
    expect(mgr.get("key1")).toBeUndefined();
  });

  it("clearAll disposes all sessions", async () => {
    const dispose = vi.fn();
    const mgr = createSessionManager<string>({ dispose });
    await mgr.getOrCreate("a", "h", async () => "sa");
    await mgr.getOrCreate("b", "h", async () => "sb");
    mgr.clearAll();
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(mgr.listSessions()).toEqual([]);
  });

  it("throws on excessively long keys", async () => {
    const mgr = createSessionManager<string>({ maxKeyLength: 10 });
    await expect(
      mgr.getOrCreate("a".repeat(11), "h", async () => "s"),
    ).rejects.toThrow("key too long");
  });
});
