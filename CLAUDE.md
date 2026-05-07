# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Primary server (v2 - web frontend + SSE streaming)
npm run start:v2

# Development with hot-reload
npm run dev:v2

# Legacy v1 server (terminal UI + non-headless Edge browser)
npm run start

# TypeScript type-check (noEmit - does NOT produce output files)
npm run build

# One-time Playwright browser setup (required after first install)
npx playwright install
```

There are no tests (`npm test` exits with an error by default).

## Environment Setup

Copy `.env.example` to `.env` and fill in:

```env
TARGET_URL=https://oa.jlu.edu.cn/
OPENROUTER_API_KEY=sk-or-v1-xxxx   # Must start with "sk-"; any other value triggers degraded mode
LLM_MODEL=stepfun/step-1-flash
BACKUP_LLM_MODEL=deepseek/deepseek-chat
```

The app checks `OPENROUTER_API_KEY` at runtime. If absent or set to `your_key_here`, every LLM-dependent feature silently falls back: keyword-based navigation instead of LLM routing, first 200 characters as summary instead of AI-generated one, and text-match search instead of vector similarity.

## Architecture

### Two Entry Points

`index.js` (v1) — Terminal UI + Playwright with `headless: false, channel: 'msedge'`. Uses `createJLUAgentTool()` from `src/agent/agent-tool.ts` which exposes a single switch-based tool dispatching `scout | dive | pipeline | parse | chat | search` actions.

`index-v2.js` (v2, **primary**) — Web frontend + SSE streaming + `headless: true` Chromium (no Edge dependency). Instantiates `FastScraperEngine`, `LightVectorDB`, and `ChatController` directly and wires them to Express routes.

### Five Modules

| Module | File | Role |
|--------|------|------|
| A: Scout | `fast-scraper.ts` / `agent-tool.actions.ts` | Playwright navigates to `TARGET_URL`, extracts all `<a>` links, asks LLM to identify the "more notices" href, then paginates (up to 20 pages, last month) |
| B: Dive | `fast-scraper.ts` (`parallelDive`) / `agent-tool.actions.ts` | Concurrently opens each notice URL; aborts image/CSS/font resources for speed; auto-detects file attachment links (`.docx/.pdf/.xlsx/.zip`) and parses up to 2 per notice via `DocumentParser.parseFromUrl()`; feeds combined body+attachment text to LLM for summarization |
| C: Parser | `document-parser.ts` | Parses `.docx` (mammoth), `.xlsx/.xls` (xlsx), `.zip` (unzipper), `.pdf` (pdf-parse) into plain text, max 50,000 chars |
| D: Memory | `vector-db.ts` | In-process JSON store persisted to `./jlu_memory.json`; uses OpenAI embeddings (`text-embedding-ada-002` via OpenRouter) + cosine similarity; falls back to substring text-match when no API key |
| E: Chat | `chat-controller.ts` | Retrieves top-3 memories from `LightVectorDB`, constructs context, calls LLM; falls back to returning raw search results if LLM fails |

### Key Design Details

**LLM resilience** (`agent-tool.actions.ts:smartAsk`): Tries `LLM_MODEL` first, then `BACKUP_LLM_MODEL`. Only used in the v1 entry point pipeline; v2 calls OpenAI directly inline.

**SSE streaming** (`sse-stream.ts`): `SSEStreamHandler` wraps an Express `Response` and emits typed `{type, payload, timestamp}` JSON events. The `/api/notices/stream` and `/api/chat/stream` routes in v2 use this.

**Direct search** (`/api/search?q=...&limit=5`): Bypasses LLM entirely — calls `vectorDB.search()` and returns ranked results with scores. Use this when you need fast retrieval without generation overhead. Also exposed as the `search` action in `agent-tool.ts`.

**Scheduled scraping** (`/api/schedule`): `POST {enabled: true, intervalSeconds: 3600}` starts a `setInterval` loop in `index-v2.js` that calls `FastScraperEngine.scrapeWithSpeed()` and stores results to `LightVectorDB`. Minimum interval is 60 seconds. State (lastRun, nextRun, runCount) is in-memory only and resets on server restart.

**Alternate vector DB** (`chroma-vector-db.ts`): `ChromaVectorDB` is a second, similar implementation that uses keyword scoring instead of embeddings. It persists to `./chroma_memory.json` and is **not wired into either entry point** — it exists as an unused alternative.

**Block Attention** (`block-attention.ts`): `RAGBlockAttention` implements softmax-weighted context block selection inspired by the "Block Attention Residuals" paper. It is **not currently called** from any route or controller — it exists as a standalone utility.

**URL sanitization** (`sanitizer.ts`): `sanitizeUrl()` strips Markdown link syntax and backtick/quote wrapping from LLM-returned URLs before passing them to `new URL()`. Always use this when handling LLM-generated hrefs.

**TypeScript configuration**: `tsconfig.json` has `"noEmit": true` and `"allowImportingTsExtensions": true`. Source files in `src/` import each other with `.ts` extensions (e.g., `import { ... } from './vector-db.ts'`). The project runs via `tsx`, not compiled `tsc` output.

**Persistence**: `jlu_memory.json` is written to the project root by `LightVectorDB` and is gitignored. It accumulates across server restarts and can be cleared via `POST /api/memories/clear`.

### Web Frontend

`frontend/index.html` is a single static file served at `/frontend/`. The v2 server redirects `/` to `/frontend/index.html`.

### Scraping Target Structure

The JLU OA site uses `div.li.rel` wrappers with `a.font14` for notice links and `.date`/`.time` for dates. The CSS selectors in `fast-scraper.ts:fastGetList` are hardcoded for this structure.
