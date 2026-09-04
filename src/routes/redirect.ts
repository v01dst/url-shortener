import type { FastifyInstance } from "fastify";
import type { Storage } from "../storage.js";

export async function redirectRoutes(
  app: FastifyInstance,
  opts: { storage: Storage }
): Promise<void> {
  const { storage } = opts;

  app.get("/:code", async (request, reply) => {
    const { code } = request.params as { code: string };
    const link = storage.getLinkByCode(code);
    if (!link) {
      return reply.status(404).send({ error: `no link for code "${code}"` });
    }

    const headers = request.headers;
    const referrer = headers.referrer ?? headers.referer ?? null;
    const forwarded = headers["x-forwarded-for"];
    const ip =
      typeof forwarded === "string"
        ? forwarded.split(",")[0]!.trim()
        : request.ip;
    const userAgent = headers["user-agent"];
    const agent = Array.isArray(userAgent) ? userAgent[0]! : userAgent;

    storage.recordClick(link.id, {
      referrer: Array.isArray(referrer) ? referrer[0]! : referrer,
      userAgent: agent ?? null,
      ip,
    });

    return reply.status(302).redirect(link.url);
  });
}
