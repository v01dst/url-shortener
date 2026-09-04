import { describe, expect, it, afterEach } from "vitest";
import { RateLimiter } from "../src/rate-limit.js";
import { createApp } from "../src/app.js";

describe("RateLimiter", () => {
  it("allows up to the max within the window", () => {
    const limiter = new RateLimiter(3, 60_000);
    expect(limiter.tryConsume("ip1").allowed).toBe(true);
    expect(limiter.tryConsume("ip1").allowed).toBe(true);
    const third = limiter.tryConsume("ip1");
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("blocks after the max and reports retry time", () => {
    const limiter = new RateLimiter(2, 10_000);
    limiter.tryConsume("ip1");
    limiter.tryConsume("ip1");
    const blocked = limiter.tryConsume("ip1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(10_000);
  });

  it("tracks clients independently", () => {
    const limiter = new RateLimiter(1, 60_000);
    limiter.tryConsume("a");
    expect(limiter.tryConsume("a").allowed).toBe(false);
    expect(limiter.tryConsume("b").allowed).toBe(true);
  });

  it("allows again once the window passes", () => {
    const limiter = new RateLimiter(1, 5_000);
    const t0 = 1_000_000;
    expect(limiter.tryConsume("a", t0).allowed).toBe(true);
    expect(limiter.tryConsume("a", t0 + 1_000).allowed).toBe(false);
    expect(limiter.tryConsume("a", t0 + 5_001).allowed).toBe(true);
  });
});

describe("POST /links rate limiting", () => {
  const app = createApp({
    config: { baseUrl: "http://test.local", rateLimitMax: 3 },
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 429 with retry-after when exceeded", async () => {
    for (let i = 0; i < 3; i++) {
      const ok = await app.inject({
        method: "POST",
        url: "/links",
        payload: { url: `https://example.com/${i}` },
      });
      expect(ok.statusCode).toBe(201);
      expect(Number(ok.headers["x-ratelimit-remaining"])).toBe(2 - i);
    }

    const blocked = await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://example.com/4" },
    });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(blocked.json().error).toMatch(/rate limit exceeded/);
  });
});

describe("GET /health", () => {
  const app = createApp({ config: { baseUrl: "http://test.local" } });

  afterEach(async () => {
    await app.close();
  });

  it("reports ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.uptimeSec).toBeGreaterThanOrEqual(0);
  });
});
