import { describe, expect, it, afterEach } from "vitest";
import { createApp } from "../src/app.js";

function build() {
  const app = createApp({ config: { baseUrl: "http://test.local" } });
  return app;
}

describe("GET /:code/stats", () => {
  let app = build();
  afterEach(async () => {
    await app.close();
    app = build();
  });

  it("returns 404 for unknown codes", async () => {
    const res = await app.inject({ method: "GET", url: "/ghost/stats" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/no link/);
  });

  it("returns empty stats for a fresh link", async () => {
    await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://example.com", code: "fresh" },
    });
    const res = await app.inject({ method: "GET", url: "/fresh/stats" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalClicks).toBe(0);
    expect(body.uniqueVisitors).toBe(0);
    expect(body.referrers).toEqual([]);
    expect(body.recentClicks).toEqual([]);
    expect(body.url).toBe("https://example.com");
  });

  it("aggregates clicks, unique visitors and referrers", async () => {
    await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://example.com/agg", code: "agg" },
    });
    const click = (ip: string, referrer?: string) =>
      app.inject({
        method: "GET",
        url: "/agg",
        headers: { "x-forwarded-for": ip, ...(referrer ? { referrer } : {}) },
      });

    await click("1.1.1.1", "https://x.com");
    await click("1.1.1.1", "https://x.com");
    await click("2.2.2.2", "https://news.ycombinator.com");
    await click("3.3.3.3");

    const res = await app.inject({ method: "GET", url: "/agg/stats" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalClicks).toBe(4);
    expect(body.uniqueVisitors).toBe(3);
    expect(body.referrers).toEqual([
      { referrer: "https://x.com", count: 2 },
      { referrer: "https://news.ycombinator.com", count: 1 },
      { referrer: "direct", count: 1 },
    ]);
    expect(body.recentClicks).toHaveLength(4);
    expect(body.recentClicks[0]!.referrer).toBeNull();
  });
});
