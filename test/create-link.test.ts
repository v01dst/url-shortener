import { describe, expect, it, afterEach } from "vitest";
import { createApp } from "../src/app.js";

function build() {
  const app = createApp({ config: { baseUrl: "http://test.local" } });
  return app;
}

describe("POST /links", () => {
  let app = build();
  afterEach(async () => {
    await app.close();
    app = build();
  });

  it("creates a short link and returns 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://example.com/some/long/path" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.code).toMatch(/^[0-9a-zA-Z]{7}$/);
    expect(body.url).toBe("https://example.com/some/long/path");
    expect(body.shortUrl).toBe(`http://test.local/${body.code}`);
  });

  it("honors a custom code", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://example.com", code: "launch" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().code).toBe("launch");
  });

  it("rejects an invalid url with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: "not-a-url" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/invalid url/);
  });

  it("rejects non-http protocols with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: "ftp://example.com/file" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a missing url with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/links",
      payload: { code: "x" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects duplicate custom codes with 409", async () => {
    await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://example.com", code: "dup" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/links",
      payload: { url: "https://other.com", code: "dup" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/already taken/);
  });
});
