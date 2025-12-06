# Repository Guidelines

## Project Structure & Module Organization
TypeScript sources live under `src/` and compile to `dist/` via `tsc` (see `tsconfig.json` for strict settings and `rootDir`). `src/index.ts` hosts the Express server that exposes `/` and `/api/agent/run`. Agent logic is isolated in `src/agent/`, Feishu integrations in `src/services/`, shared configuration in `src/config/`, and LangChain tools in `src/tools/`. Keep runtime assets beside the module that consumes them and never edit generated files inside `dist/` directly.

## Build, Test, and Development Commands
- `npm run dev` — run the API with `nodemon` + `ts-node` for fast iteration.
- `npm run build` — type-check and emit JavaScript into `dist/`.
- `npm start` — execute the compiled server (`dist/index.js`) to mirror production.
- `npx tsc --noEmit` — quick validation step for pull requests when build artifacts are untouched.
- `npm run test:proxy` — fire a minimal LangChain prompt against OpenAI to ensure the configured proxy + credentials work end-to-end.

## Coding Style & Naming Conventions
Use two-space indentation, single quotes, and `camelCase` for values while reserving `PascalCase` for classes such as `FeishuService`. Keep modules narrow in scope: HTTP glue in `src/index.ts`, orchestration in `src/agent/`, integrations in `src/services/`, tools in `src/tools/`. Prefer async/await, avoid side effects at import time, and route all secrets through `src/config/env.ts`. Run `npm run build` before sending changes to confirm strict typing still passes.

## Testing Guidelines
No framework is wired up yet, so introduce `vitest` or `jest`, replace the placeholder `npm test` script, and colocate specs as `*.spec.ts` files or under `src/__tests__/`. Focus on Feishu signing logic, tool schema validation, and HTTP handler responses. Tests should mock axios to avoid hitting the webhook and assert that agent outputs trigger the Feishu tool only when required.

## Security & Configuration Tips
Secrets load from `.env` via `dotenv`. Populate `PORT`, `OPENAI_API_KEY`, `FEISHU_WEBHOOK_URL`, and `FEISHU_SECRET`, and share them through your secret manager rather than version control. Set `OPENAI_PROXY_URL` (or `HTTP(S)_PROXY`) when local traffic must traverse a proxy; startup code now installs an `https-proxy-agent` so LangChain/OpenAI SDK traffic stays inside that tunnel. Use disposable Feishu webhooks for local runs and verify console logs for signature warnings before promoting changes.

## Commit & Pull Request Guidelines
There is no git history yet, so adopt Conventional Commits (`feat: add feishu retries`, `chore: tighten config warnings`) for consistency. Pull requests should summarize intent, link GitHub issues, note validation steps (`npm run build`, manual Feishu ping), and include logs or screenshots whenever API behavior changes. Request review whenever LangChain prompts, tools, or Feishu wiring are touched.
