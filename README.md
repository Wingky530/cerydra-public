# Cerydra

Cerydra is an anime streaming application built with Astro 6 SSR, React 19, Material UI 9, and TypeScript. It aggregates metadata from Anilist and sources video streams via a custom Cloudflare Worker proxy.

## Architecture and Tech Stack

- **Framework:** Astro 6 (SSR) with React 19 Islands
- **UI:** Material UI 9, Emotion, Tailwind CSS v3
- **Video Player:** Vidstack React v1
- **Data Fetching:** TanStack React Query (Client), Custom Caching (Server)
- **Database:** Turso (Edge SQLite via `@libsql/client`) with local SQLite fallback
- **Proxy/Video Delivery:** Cloudflare Worker (`cerydra-video-proxy`)
- **Deployment:** Vercel (via `@astrojs/vercel`)
- **Package Manager:** pnpm

## Features

- **Metadata Resolution:** Maps Anilist IDs to external provider IDs using fuzzy string matching and a local caching layer.
- **Custom Video Player:** Built on Vidstack with custom MD3 controls, wave seekbar, double-tap seeking, and persistent PiP.
- **Global Player State:** Utilizes Astro View Transitions and `transition:persist` to maintain continuous video playback during page navigation.
- **Watch History:** State synchronized to Turso Database, enabling cross-device resume capabilities.
- **Source Auto-Selection:** Evaluates and prioritizes direct MP4/HLS streams over iframe embeds.
- **Fallback Handling:** Implements a direct iframe fallback mechanism (MegaPlay) when primary proxy endpoints fail or return HTTP 410.

## Project Structure

```
src/
├── components/        React UI components (Md3VideoPlayer, AppShell, WatchContent)
├── hooks/             React hooks for data synchronization (useWatchHistory)
├── lib/               Core utilities (turso.ts, anilist.ts, allanime.ts)
├── pages/             Astro routing and Server-Side API endpoints
│   ├── api/anime/     Anilist metadata retrieval
│   ├── api/mapping/   ID resolution and stream extraction
│   └── api/history/   Database operations for user progress
├── pages-react/       Client-side hydrated React pages
├── layouts/           Astro document shells
└── theme/             MUI theme configuration
```

## Development Commands

| Command | Action |
|---------|--------|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start local development server (port 4321) |
| `pnpm build` | Build application for production SSR |
| `pnpm preview` | Preview production build locally |
| `pnpm migrate` | Execute database migrations |

## Configuration

The application requires environment variables for production database access. Create a `.env` file in the root directory:

```env
TURSO_DB_URL=libsql://cerydra-xxxx.turso.io
TURSO_DB_AUTH_TOKEN=xxxx
```

If these variables are omitted, the application will fallback to a local SQLite database (`file:local.db`).

### Database Initialization

To create the required schemas (`watch_history`, `cache_index`), run the migration command before starting the development server:

```bash
pnpm migrate
```

## API Flow

1. **Metadata:** Client requests metadata via `api/anime/[id]`.
2. **Resolution:** Client triggers `api/mapping/resolve` to match the Anilist ID with streaming provider identifiers.
3. **Extraction:** `api/mapping/episode-links` decrypts provider payloads and returns raw HLS/MP4 streams.
4. **Playback:** Direct streams are routed through the Cloudflare Worker Proxy to circumvent CORS restrictions.

## License

MIT
