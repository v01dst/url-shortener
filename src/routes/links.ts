import type { FastifyInstance } from "fastify";
import type { Storage } from "../storage.js";
import type { RateLimiter } from "../rate-limit.js";

const errorResponse = {
  type: "object",
  properties: { error: { type: "string" } },
  required: ["error"],
} as const;

export async function linkRoutes(
  app: FastifyInstance,
  opts: { storage: Storage; baseUrl: string; limiter: RateLimiter }
): Promise<void> {
  const { storage, baseUrl, limiter } = opts;

  app.get(
    "/links/:code/info",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              code: { type: "string" },
              url: { type: "string" },
              shortUrl: { type: "string" },
              createdAt: { type: "string" },
              totalClicks: { type: "number" },
              active: { type: "boolean" },
            },
            required: ["code", "url", "shortUrl", "createdAt", "totalClicks", "active"],
          },
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const link = storage.getLinkByCode(code);
      if (!link) {
        return reply.status(404).send({ error: `no link for code "${code}"` });
      }
      return reply.status(200).send({
        code: link.code,
        url: link.url,
        shortUrl: `${baseUrl}/${link.code}`,
        createdAt: link.created_at,
        totalClicks: link.clicks,
        active: Boolean(link.active),
      });
    }
  );

  app.delete(
    "/links/:code",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: { deactivated: { type: "boolean" } },
            required: ["deactivated"],
          },
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const ok = storage.deactivate(code);
      if (!ok) {
        return reply.status(404).send({ error: `no link for code "${code}"` });
      }
      return reply.status(200).send({ deactivated: true });
    }
  );

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
