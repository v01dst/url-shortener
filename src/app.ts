import Fastify, { type FastifyInstance } from "fastify";
import { openDb, type Db } from "./db.js";
import { Storage } from "./storage.js";
import { linkRoutes } from "./routes/links.js";
import type { Config } from "./config.js";

export interface AppOptions {
  config: Partial<Config> & { baseUrl: string };
  db?: Db;
  logger?: boolean;
}

export function createApp(opts: AppOptions): FastifyInstance {
  const db = opts.db ?? openDb(":memory:");
  const storage = new Storage(db);
  const { baseUrl } = opts.config;

  const app = Fastify({
    logger: opts.logger ?? false,
  });

  app.decorate("storage", storage);
  app.decorate("db", db);

  app.register(linkRoutes, { storage, baseUrl });

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
