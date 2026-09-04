import { describe, expect, it, afterEach } from "vitest";
import { createApp } from "../src/app.js";

function build() {
  const app = createApp({ config: { baseUrl: "http://test.local" } });
  return app;
}

describe("GET /:code", () => {
  let app = build();
  afterEach(async () => {
    await app.close();
    app = build();
  });

  it("redirects to the target url with 302", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://example.com/landing" },
    });
    const { code } = created.json();

    const res = await app.inject({ method: "GET", url: `/${code}` });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://example.com/landing");
  });

  it("returns 404 for unknown codes", async () => {
    const res = await app.inject({ method: "GET", url: "/ghost" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/no link/);
  });

  it("records a click with referrer, agent and ip", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://example.com/tracked", code: "clicks" },
    });
    expect(created.statusCode).toBe(201);

    await app.inject({
      method: "GET",
      url: "/clicks",
      headers: {
        referrer: "https://x.com/post",
        "user-agent": "TestAgent/1.0",
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      },
    });

    const stats = app.storage.getStats("clicks")!;
    expect(stats.totalClicks).toBe(1);
    expect(stats.uniqueVisitors).toBe(1);
    expect(stats.recentClicks[0]!.referrer).toBe("https://x.com/post");
    expect(stats.recentClicks[0]!.userAgent).toBe("TestAgent/1.0");
  });

  it("uses request.ip when no x-forwarded-for header", async () => {
    await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://example.com", code: "noxff" },
    });
    await app.inject({ method: "GET", url: "/noxff" });
    const stats = app.storage.getStats("noxff")!;
    expect(stats.totalClicks).toBe(1);
    expect(stats.uniqueVisitors).toBe(1);
  });

  it("counts multiple clicks across requests", async () => {
    await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://example.com/multi", code: "multi" },
    });
    await app.inject({ method: "GET", url: "/multi" });
    await app.inject({ method: "GET", url: "/multi" });
    await app.inject({ method: "GET", url: "/multi" });
    const stats = app.storage.getStats("multi")!;
    expect(stats.totalClicks).toBe(3);
  });

  it("does not record clicks for unknown codes", async () => {
    await app.inject({ method: "GET", url: "/nothing" });
    expect(app.storage.getStats("nothing")).toBeUndefined();
  });
});
