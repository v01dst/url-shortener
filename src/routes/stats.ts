import type { FastifyInstance } from "fastify";
import type { Storage } from "../storage.js";

export async function statsRoutes(
  app: FastifyInstance,
  opts: { storage: Storage }
): Promise<void> {
  const { storage } = opts;

  app.get(
    "/:code/stats",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              code: { type: "string" },
              url: { type: "string" },
              createdAt: { type: "string" },
              totalClicks: { type: "number" },
              uniqueVisitors: { type: "number" },
              referrers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    referrer: { type: "string" },
                    count: { type: "number" },
                  },
                  required: ["referrer", "count"],
                },
              },
              recentClicks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    clickedAt: { type: "string" },
                    referrer: { type: ["string", "null"] },
                    userAgent: { type: ["string", "null"] },
                  },
                  required: ["clickedAt", "referrer", "userAgent"],
                },
              },
            },
            required: [
              "code",
              "url",
              "createdAt",
              "totalClicks",
              "uniqueVisitors",
              "referrers",
              "recentClicks",
            ],
          },
          404: {
            type: "object",
            properties: { error: { type: "string" } },
            required: ["error"],
          },
        },
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const stats = storage.getStats(code);
      if (!stats) {
        return reply.status(404).send({ error: `no link for code "${code}"` });
      }
      return reply.status(200).send(stats);
    }
  );
}
