import type { FastifyInstance } from "fastify";
import type { Storage } from "../storage.js";
import type { RateLimiter } from "../rate-limit.js";

export async function linkRoutes(
  app: FastifyInstance,
  opts: { storage: Storage; baseUrl: string; limiter: RateLimiter }
): Promise<void> {
  const { storage, baseUrl, limiter } = opts;

  app.post(
    "/links",
    {
      preHandler: async (request, reply) => {
        const result = limiter.tryConsume(request.ip);
        reply.header("x-ratelimit-limit", limiter.max);
        reply.header("x-ratelimit-remaining", result.remaining);
        if (!result.allowed) {
          const retrySec = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
          reply.header("retry-after", String(retrySec));
          return reply
            .status(429)
            .send({ error: `rate limit exceeded, retry in ${retrySec}s` });
        }
      },
      schema: {
        body: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string" },
            code: { type: "string", minLength: 1, maxLength: 64 },
          },
          additionalProperties: false,
        },
        response: {
          201: {
            type: "object",
            properties: {
              code: { type: "string" },
              url: { type: "string" },
              shortUrl: { type: "string" },
              createdAt: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: { error: { type: "string" } },
            required: ["error"],
          },
          409: {
            type: "object",
            properties: { error: { type: "string" } },
            required: ["error"],
          },
          429: {
            type: "object",
            properties: { error: { type: "string" } },
            required: ["error"],
          },
        },
      },
    },
    async (request, reply) => {
      const { url, code } = request.body as { url: string; code?: string };
      try {
        const link = storage.createLink(url, code);
        return reply.status(201).send({
          code: link.code,
          url: link.url,
          shortUrl: `${baseUrl}/${link.code}`,
          createdAt: link.created_at,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "InvalidUrlError") {
          return reply.status(400).send({ error: err.message });
        }
        if (err instanceof Error && err.name === "CodeConflictError") {
          return reply.status(409).send({ error: err.message });
        }
        throw err;
      }
    }
  );
}
