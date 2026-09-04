<div align="center">

# 🔗 url-shortener

**Production-grade URL shortener with click analytics — self-hostable in one command.**

[![CI](https://github.com/v01dst/url-shortener/actions/workflows/ci.yml/badge.svg)](https://github.com/v01dst/url-shortener/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/license-MIT-8A2BE2)
![Node](https://img.shields.io/badge/node-22-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-strict-3178C6?logo=typescript&logoColor=white)
![Fastify](https://img.shields.io/badge/fastify-5-000000?logo=fastify&logoColor=white)
![SQLite](https://img.shields.io/badge/sqlite-WAL-003B57?logo=sqlite&logoColor=white)
![Tests](https://img.shields.io/badge/tests-35%20passing-brightgreen)

`create short links` · `track every click` · `know your audience` · `own your data`

</div>

---

## ✨ Features

- **⚡ Fast redirects** — 302 with sub-millisecond SQLite lookups (WAL mode)
- **📊 Click analytics** — total clicks, unique visitors, referrer breakdown, recent click stream
- **🎯 Custom codes** — claim your own slugs (`/launch`) or let the service generate base62 codes
- **🛡️ Rate limiting** — per-IP sliding window protection on link creation (`429` + `Retry-After`)
- **🗄️ Zero-dependency storage** — embedded SQLite, no external services to babysit
- **🐳 One-command deploy** — slim Docker image with healthcheck + persistent volume
- **🧪 35 tests** — full unit + integration coverage, strict TypeScript throughout
- **❤️ Health endpoint** — for load balancers, uptime monitors, and container orchestrators

## 🚀 Quick Start

```bash
git clone https://github.com/v01dst/url-shortener
cd url-shortener
npm ci
npm start
```

Or with Docker:

```bash
docker compose up -d
```

The API is now live at `http://localhost:3000`.

## 📡 API

| Method   | Endpoint         | Description                    |
|----------|------------------|--------------------------------|
| `POST`   | `/links`         | Create a short link            |
| `GET`    | `/:code`         | Redirect + record click        |
| `GET`    | `/:code/stats`   | Analytics for one link         |
| `GET`    | `/health`        | Liveness probe                 |

### Create a link

```bash
curl -X POST http://localhost:3000/links \
  -H 'content-type: application/json' \
  -d '{"url": "https://example.com/very/long/path", "code": "launch"}'
```

```json
{
  "code": "launch",
  "url": "https://example.com/very/long/path",
  "shortUrl": "http://localhost:3000/launch",
  "createdAt": "2026-09-04T02:00:00.000Z"
}
```

### Follow it

```bash
curl -i http://localhost:3000/launch
# HTTP/1.1 302 Found
# location: https://example.com/very/long/path
```

### Read the stats

```bash
curl http://localhost:3000/launch/stats
```

```json
{
  "code": "launch",
  "url": "https://example.com/very/long/path",
  "createdAt": "2026-09-04T02:00:00.000Z",
  "totalClicks": 4,
  "uniqueVisitors": 3,
  "referrers": [
    { "referrer": "https://x.com", "count": 2 },
    { "referrer": "direct", "count": 1 }
  ],
  "recentClicks": [
    { "clickedAt": "2026-09-04T02:05:12.000Z", "referrer": null, "userAgent": "curl/8.5.0" }
  ]
}
```

### Errors

| Status | Meaning                              |
|--------|--------------------------------------|
| `400`  | Invalid/non-HTTP URL or missing body |
| `404`  | Unknown short code                   |
| `409`  | Custom code already taken            |
| `429`  | Rate limit exceeded                  |

## ⚙️ Configuration

| Variable               | Default                  | Description                     |
|------------------------|--------------------------|---------------------------------|
| `PORT`                 | `3000`                   | Listen port                     |
| `HOST`                 | `0.0.0.0`                | Bind address                    |
| `DB_PATH`              | `./data/shortlinks.db`   | SQLite file location            |
| `BASE_URL`             | `http://localhost:3000`  | Public base URL in `shortUrl`   |
| `RATE_LIMIT_MAX`       | `30`                     | Max `POST /links` per window/IP |
| `RATE_LIMIT_WINDOW_MS` | `60000`                  | Rate limit window (ms)          |

## 🧪 Development

```bash
npm run dev          # watch mode
npm test             # run the 35-test suite
npm run typecheck    # strict TS, zero errors
```

## 🧱 Tech Stack

| Layer      | Tech                          |
|------------|-------------------------------|
| Runtime    | Node.js 22                    |
| Language   | TypeScript (strict)           |
| Framework  | Fastify 5                     |
| Storage    | SQLite via better-sqlite3     |
| Testing    | Vitest 5 (unit + integration) |
| Packaging  | Docker + docker-compose       |
| CI         | GitHub Actions                |

---

<div align="center">

Built with ⚡ by **v01dst**

[![GitHub](https://img.shields.io/badge/github-v01dst-181717?logo=github)](https://github.com/v01dst)
[![Discord](https://img.shields.io/badge/discord-9p.1-5865F2?logo=discord&logoColor=white)](https://discord.com/users/9p.1)

*Project 001 / 99 — The Loop*

</div>
