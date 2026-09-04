import Fastify, { type FastifyInstance } from "fastify";
import { openDb, type Db } from "./db.js";
import { Storage } from "./storage.js";
import { RateLimiter } from "./rate-limit.js";
import { DEFAULT_CONFIG, type Config } from "./config.js";
import { linkRoutes } from "./routes/links.js";
import { redirectRoutes } from "./routes/redirect.js";
import { statsRoutes } from "./routes/stats.js";

export interface AppOptions {
  config?: Partial<Config>;
  db?: Db;
  logger?: boolean;
}

export function createApp(opts: AppOptions = {}): FastifyInstance {
  const config: Config = { ...DEFAULT_CONFIG, ...opts.config };
  const db = opts.db ?? openDb(":memory:");
  const storage = new Storage(db);
  const limiter = new RateLimiter(config.rateLimitMax, config.rateLimitWindowMs);
  const startedAt = Date.now();

  const app = Fastify({
    logger: opts.logger ?? false,
  });

  app.decorate("storage", storage);
  app.decorate("db", db);

  app.register(linkRoutes, { storage, baseUrl: config.baseUrl, limiter });
  app.register(redirectRoutes, { storage });
  app.register(statsRoutes, { storage });

  app.get("/health", async () => ({
    status: "ok",
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
  }));

  app.get("/", async () => ({
    service: "url-shortener",
    version: "1.0.0",
    author: "v01dst",
  }));

  app.addHook("onClose", async () => {
    if (!opts.db) db.close();
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    storage: Storage;
    db: Db;
  }
}
