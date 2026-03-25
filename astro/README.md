# Pageel CMS — Astro App

This is the Astro server application of Pageel CMS v2.0.

## Commands

| Command           | Action                                      |
| :---------------- | :------------------------------------------ |
| `npm install`     | Install dependencies                        |
| `npm run dev`     | Start local dev server at `localhost:4321`   |
| `npm run build`   | Build production bundle to `./dist/`        |
| `npm run preview` | Preview production build locally            |

## Configuration

Copy `.env.example` to `.env` and fill in your credentials. See [docs/deployment.md](../docs/deployment.md) for details.

## Architecture

- `src/pages/` — Astro routes (login, cms, API endpoints)
- `src/lib/` — Server-side auth, session, git-client
- `src/components/` — React SPA (mounted on `/cms`)
- `src/middleware.ts` — Session guard for protected routes
