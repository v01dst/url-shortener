import Fastify, { type FastifyInstance } from "fastify";

export function createApp(opts: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({
    logger: opts.logger ?? false,
  });

  app.get("/", async () => ({
    service: "url-shortener",
    version: "1.0.0",
    author: "v01dst",
  }));

  return app;
}
