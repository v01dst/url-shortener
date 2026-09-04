export interface Config {
  port: number;
  host: string;
  dbPath: string;
  baseUrl: string;
  rateLimitMax: number;
  rateLimitWindowMs: number;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: intEnv("PORT", 3000),
    host: env.HOST ?? "0.0.0.0",
    dbPath: env.DB_PATH ?? "./data/shortlinks.db",
    baseUrl: env.BASE_URL ?? `http://localhost:${intEnv("PORT", 3000)}`,
    rateLimitMax: intEnv("RATE_LIMIT_MAX", 30),
    rateLimitWindowMs: intEnv("RATE_LIMIT_WINDOW_MS", 60_000),
  };
}
