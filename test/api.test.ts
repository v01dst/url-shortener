import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";


describe("info + deactivation", () => {
  it("returns link info without redirecting", async () => {
    const app2 = createApp({ config: { baseUrl: "http://t.local" } });
    await app2.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://example.com", code: "info1" },
    });
    const res = await app2.inject({ url: "/links/info1/info" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe("info1");
    expect(body.active).toBe(true);
    expect(body.totalClicks).toBe(0);
    await app2.close();
  });

  it("deactivates then 404s redirects, info still works", async () => {
    const app2 = createApp({ config: { baseUrl: "http://t.local" } });
    await app2.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://example.com", code: "kill" },
    });
    const del = await app2.inject({ method: "DELETE", url: "/links/kill" });
    expect(del.json().deactivated).toBe(true);

    const redir = await app2.inject({ url: "/kill" });
    expect(redir.statusCode).toBe(404);

    const info = await app2.inject({ url: "/links/kill/info" });
    expect(info.statusCode).toBe(200);
    expect(info.json().active).toBe(false);
    await app2.close();
  });

  it("404s info and delete for unknown codes", async () => {
    const app2 = createApp({ config: { baseUrl: "http://t.local" } });
    expect((await app2.inject({ url: "/links/ghost/info" })).statusCode).toBe(404);
    expect((await app2.inject({ method: "DELETE", url: "/links/ghost" })).statusCode).toBe(404);
    await app2.close();
  });
});

describe("GET /links", () => {
  it("lists created links newest first without active links", async () => {
    const app2 = createApp({ config: { baseUrl: "http://t.local" } });
    await app2.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://one.example", code: "one" },
    });
    await app2.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://two.example", code: "two" },
    });
    const res = await app2.inject({ url: "/links" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBe(2);
    expect(body.links[0].code).toBe("two");
    expect(body.links[1].code).toBe("one");
    expect(body.links[0].shortUrl).toBe("http://t.local/two");
    await app2.close();
  });

  it("reflects deactivation in the list", async () => {
    const app2 = createApp({ config: { baseUrl: "http://t.local" } });
    await app2.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://x.example", code: "dead" },
    });
    await app2.inject({ method: "DELETE", url: "/links/dead" });
    const res = await app2.inject({ url: "/links" });
    expect(res.json().links[0].active).toBe(false);
    await app2.close();
  });
});
