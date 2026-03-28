# YMSNOW — Yard Management System

## Overview

Production-grade Yard Management System (YMS) built as a pnpm monorepo with TypeScript. Features 15+ operational pages with real-time data, AI-powered email intelligence, and an interactive yard map.

## Stack

- **Monorepo tool**: pnpm workspaces (workspace root: `replit/`)
- **Node.js version**: 24
- **Package manager**: pnpm
- **Frontend**: React + Vite + shadcn/ui + Wouter + TanStack Query + Framer Motion
- **Backend**: Express 5 + Drizzle ORM + PostgreSQL
- **AI**: OpenAI (via Replit AI Integrations — `AI_INTEGRATIONS_OPENAI_API_KEY`)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Build**: esbuild (API server), Vite (frontend)

## Replit Environment Setup

- **Database**: Replit PostgreSQL (DATABASE_URL env var)
- **Frontend port**: 5000 (webview workflow)
- **Backend port**: 8080 (console workflow)
- **Frontend proxies `/api` → localhost:8080**

## Workflows

- **Start application**: `cd replit && PORT=5000 pnpm --filter @workspace/yms run dev` (port 5000, webview)
- **Start API Server**: `cd replit && PORT=8080 pnpm --filter @workspace/api-server run dev` (port 8080, console)

## Structure

```text
replit/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   └── yms/                # React frontend (port 5000)
├── lib/
│   ├── db/                 # Drizzle ORM schema + DB connection (@workspace/db)
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   └── api-zod/            # Generated Zod schemas
└── scripts/
    └── post-merge.sh       # pnpm install + db push
```

## Development Commands

```bash
# Install all dependencies
cd replit && pnpm install

# Push DB schema (first time or after schema changes)
cd replit && pnpm --filter @workspace/db run push

# Start API server (dev)
cd replit && PORT=8080 pnpm --filter @workspace/api-server run dev

# Start YMS frontend (dev)
cd replit && PORT=5000 pnpm --filter @workspace/yms run dev
```

## Deployment

- Target: autoscale
- Build: `cd replit && pnpm --filter @workspace/db run push && pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/yms run build`
- Run: `cd replit && PORT=8080 node artifacts/api-server/dist/index.cjs & PORT=5000 pnpm --filter @workspace/yms run serve`

## AI Features

The AI assistant and email intelligence use OpenAI. Connect via Replit AI Integrations (OpenAI connector) which sets `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` automatically. The system gracefully degrades if no key is configured.
