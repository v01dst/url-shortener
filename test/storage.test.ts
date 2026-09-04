import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { openDb, type Db } from "../src/db.js";
import {
  CodeConflictError,
  InvalidUrlError,
  Storage,
  generateCode,
  isValidUrl,
} from "../src/storage.js";

describe("isValidUrl", () => {
  it("accepts http and https urls", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://example.com/path?q=1")).toBe(true);
  });

  it("rejects non-http protocols and garbage", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});

describe("generateCode", () => {
  it("generates base62 codes of the default length", () => {
    const code = generateCode();
    expect(code).toMatch(/^[0-9a-zA-Z]{7}$/);
  });

  it("generates unique codes", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateCode()));
    expect(codes.size).toBe(200);
  });
});

describe("Storage", () => {
  let db: Db;
  let storage: Storage;

  beforeEach(() => {
    db = openDb(":memory:");
    storage = new Storage(db);
  });

  afterEach(() => {
    storage.close();
  });

  it("creates a link with a generated code", () => {
    const link = storage.createLink("https://example.com");
    expect(link.url).toBe("https://example.com");
    expect(link.code).toMatch(/^[0-9a-zA-Z]{7}$/);
    expect(link.clicks).toBe(0);
    expect(link.created_at).toBeTruthy();
  });

  it("creates a link with a custom code", () => {
    const link = storage.createLink("https://example.com", "my-code");
    expect(link.code).toBe("my-code");
  });

  it("rejects invalid urls", () => {
    expect(() => storage.createLink("nope")).toThrow(InvalidUrlError);
  });

  it("rejects duplicate custom codes", () => {
    storage.createLink("https://example.com", "taken");
    expect(() =>
      storage.createLink("https://other.com", "taken")
    ).toThrow(CodeConflictError);
  });

  it("retries generated codes on collision", () => {
    let calls = 0;
    const flaky = new Storage(db, () =>
      calls++ === 0 ? "collision" : "unique1"
    );
    flaky.createLink("https://example.com", "collision");
    const link = flaky.createLink("https://other.com");
    expect(link.code).toBe("unique1");
  });

  it("gives up after too many collisions", () => {
    const cursed = new Storage(db, () => "taken");
    cursed.createLink("https://example.com", "taken");
    expect(() => cursed.createLink("https://other.com")).toThrow(
      /failed to generate/
    );
  });

  it("finds links by code", () => {
    const link = storage.createLink("https://example.com", "findme");
    expect(storage.getLinkByCode("findme")?.id).toBe(link.id);
    expect(storage.getLinkByCode("missing")).toBeUndefined();
  });

  it("records clicks and increments the counter", () => {
    const link = storage.createLink("https://example.com", "track");
    storage.recordClick(link.id, { referrer: "https://news.ycombinator.com", ip: "1.1.1.1" });
    storage.recordClick(link.id, { ip: "2.2.2.2" });
    const row = storage.getLinkByCode("track")!;
    expect(row.clicks).toBe(2);
    const stats = storage.getStats("track")!;
    expect(stats.totalClicks).toBe(2);
    expect(stats.uniqueVisitors).toBe(2);
  });

  it("returns undefined stats for unknown codes", () => {
    expect(storage.getStats("nope")).toBeUndefined();
  });

  it("builds referrer breakdown with direct fallback", () => {
    const link = storage.createLink("https://example.com", "stats");
    storage.recordClick(link.id, { referrer: "https://x.com", ip: "1.1.1.1" });
    storage.recordClick(link.id, { referrer: "https://x.com", ip: "1.1.1.1" });
    storage.recordClick(link.id, { ip: "2.2.2.2" });
    const stats = storage.getStats("stats")!;
    expect(stats.referrers).toEqual([
      { referrer: "https://x.com", count: 2 },
      { referrer: "direct", count: 1 },
    ]);
    expect(stats.recentClicks).toHaveLength(3);
    expect(stats.recentClicks[0]!.referrer).toBeNull();
  });
});
