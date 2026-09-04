import { randomBytes } from "node:crypto";
import type { Db } from "./db.js";

const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_LENGTH = 7;
const MAX_GENERATE_ATTEMPTS = 5;

export class CodeConflictError extends Error {
  constructor(code: string) {
    super(`short code "${code}" is already taken`);
    this.name = "CodeConflictError";
  }
}

export class InvalidUrlError extends Error {
  constructor(url: string) {
    super(`invalid url: ${url}`);
    this.name = "InvalidUrlError";
  }
}

export interface LinkRow {
  id: number;
  code: string;
  url: string;
  created_at: string;
  clicks: number;
}

export interface ClickRow {
  id: number;
  link_id: number;
  clicked_at: string;
  referrer: string | null;
  user_agent: string | null;
  ip: string | null;
}

export interface ClickInput {
  referrer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}

export interface LinkStats {
  code: string;
  url: string;
  createdAt: string;
  totalClicks: number;
  uniqueVisitors: number;
  referrers: { referrer: string; count: number }[];
  recentClicks: {
    clickedAt: string;
    referrer: string | null;
    userAgent: string | null;
  }[];
}

export function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function generateCode(length: number = CODE_LENGTH): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return code;
}

export class Storage {
  constructor(
    private readonly db: Db,
    private readonly generateCodeFn: (length?: number) => string = generateCode
  ) {}

  createLink(url: string, customCode?: string): LinkRow {
    if (!isValidUrl(url)) {
      throw new InvalidUrlError(url);
    }

    if (customCode !== undefined) {
      return this.insert(url, customCode);
    }

    for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt++) {
      try {
        return this.insert(url, this.generateCodeFn());
      } catch (err) {
        if (!(err instanceof CodeConflictError)) throw err;
      }
    }
    throw new Error("failed to generate a unique short code");
  }

  private insert(url: string, code: string): LinkRow {
    const stmt = this.db.prepare(
      "INSERT INTO links (code, url) VALUES (?, ?)"
    );
    try {
      const info = stmt.run(code, url);
      return this.getLinkById(Number(info.lastInsertRowid))!;
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("UNIQUE constraint failed: links.code")
      ) {
        throw new CodeConflictError(code);
      }
      throw err;
    }
  }

  getLinkByCode(code: string): LinkRow | undefined {
    return this.db.prepare("SELECT * FROM links WHERE code = ?").get(code) as
      | LinkRow
      | undefined;
  }

  private getLinkById(id: number): LinkRow | undefined {
    return this.db.prepare("SELECT * FROM links WHERE id = ?").get(id) as
      | LinkRow
      | undefined;
  }

  recordClick(linkId: number, input: ClickInput = {}): void {
    const insert = this.db.prepare(
      "INSERT INTO clicks (link_id, referrer, user_agent, ip) VALUES (?, ?, ?, ?)"
    );
    const increment = this.db.prepare(
      "UPDATE links SET clicks = clicks + 1 WHERE id = ?"
    );
    const tx = this.db.transaction(() => {
      insert.run(linkId, input.referrer ?? null, input.userAgent ?? null, input.ip ?? null);
      increment.run(linkId);
    });
    tx();
  }

  getStats(code: string): LinkStats | undefined {
    const link = this.getLinkByCode(code);
    if (!link) return undefined;

    const uniqueStmt = this.db.prepare(
      "SELECT COUNT(DISTINCT ip) AS n FROM clicks WHERE link_id = ? AND ip IS NOT NULL"
    );
    const referrerStmt = this.db.prepare(
      `SELECT COALESCE(referrer, 'direct') AS referrer, COUNT(*) AS count
       FROM clicks WHERE link_id = ?
       GROUP BY COALESCE(referrer, 'direct')
       ORDER BY count DESC
       LIMIT 10`
    );
    const recentStmt = this.db.prepare(
      `SELECT clicked_at, referrer, user_agent
       FROM clicks WHERE link_id = ?
       ORDER BY id DESC
       LIMIT 10`
    );

    const uniqueVisitors = (uniqueStmt.get(link.id) as { n: number }).n;
    const referrers = referrerStmt.all(link.id) as {
      referrer: string;
      count: number;
    }[];
    const recent = recentStmt.all(link.id) as {
      clicked_at: string;
      referrer: string | null;
      user_agent: string | null;
    }[];

    return {
      code: link.code,
      url: link.url,
      createdAt: link.created_at,
      totalClicks: link.clicks,
      uniqueVisitors,
      referrers,
      recentClicks: recent.map((r) => ({
        clickedAt: r.clicked_at,
        referrer: r.referrer,
        userAgent: r.user_agent,
      })),
    };
  }

  close(): void {
    this.db.close();
  }
}
