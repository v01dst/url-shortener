import type { FastifyInstance } from "fastify";
import type { Storage } from "../storage.js";

export async function linkRoutes(
  app: FastifyInstance,
  opts: { storage: Storage; baseUrl: string }
): Promise<void> {
  const { storage, baseUrl } = opts;

  app.post(
    "/links",
    {
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
