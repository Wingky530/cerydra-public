# AGENTS.md — Cerydra

**Anime streaming app.** Astro 6 SSR + React 19 islands + Tailwind v3 + Material UI 9 + Vidstack player. Deployed on Vercel.

---

## Startup Workflow

Before writing any code:

1. **Read `feature_list.json`** — see current feature state, pick one unfinished feature
2. **Read `progress.md`** — see what happened last session
3. **Run `./init.sh`** — verify environment is healthy (install + type-check). Build only when requested (slow).
4. **Read this file** completely
5. **Read `DESIGN.md` and `PRODUCT.md`** for design/product context
6. **Review recent commits** with `git log --oneline -5`

If baseline verification fails, repair that first before adding new scope.

---

## Working Rules

- **One feature at a time**: Pick exactly one unfinished feature from `feature_list.json`
- **Verification required**: Don't claim done without passing `./init.sh`
- **Update artifacts**: Before ending session, update `progress.md` and `feature_list.json`
- **Stay in scope**: Don't modify files unrelated to the current feature
- **Leave clean state**: Next session must be able to run `./init.sh` immediately

---

## Definition of Done

A feature is done only when ALL are true:

- [ ] Target behavior is implemented
- [ ] `./init.sh` passes (type-check + build clean, no regressions)
- [ ] Evidence recorded in `feature_list.json` (`evidence` field set)
- [ ] `progress.md` updated with what was done

---

## End of Session

Before ending a session:

1. **Update `progress.md`** with current state, blockers, decisions
2. **Update `feature_list.json`** with new status + evidence
3. **If work is incomplete**, fill `session-handoff.md` for next session
4. **Commit** with descriptive conventional commit message
5. **Verify** `./init.sh` still passes after your changes

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Astro 6, React 19, TypeScript |
| Styling | Tailwind CSS v3, MUI 9, Emotion |
| Player | **Vidstack React v1** + hls.js |
| Data | TanStack React Query (client), cheerio (anime-cache.ts server) |
| DB | **Turso** (Edge SQLite via `@libsql/client`) with local SQLite fallback |
| Deploy | Vercel SSR (via `@astrojs/vercel`) |
| Video CDN | **Cloudflare Worker** (`cerydra-video-proxy`) — R2 cache + Queue-based background caching |
| Video Delivery | `WatchContent.tsx` sets `activeUrl` **directly to Worker URL** (no redirect hop) — proxy-video.ts is deprecated/unused |
| Package manager | **pnpm** |

---

## Commands

```bash
pnpm dev              # Dev server (port 4321)
pnpm build            # Build for production
pnpm preview           # Preview production build
pnpm migrate          # Jalankan migration DB (scripts/migrate.ts)
pnpm astro <cmd>      # Astro CLI
```

---

## Project Structure

```
src/
├── components/           React components
│   ├── Md3VideoPlayer    Custom player (MD3 controls + snake seekbar)
│   ├── VideoPlayer       OLD — no longer imported (can delete)
│   ├── AppShell          Bottom nav + layout shell
│   ├── AnimeCard         Poster card
│   ├── EpisodeList       Episode list sidebar
│   ├── ContinueWatching  History row on homepage
│   ├── HeroCarousel      Trending carousel
│   └── ...
├── hooks/
│   ├── useWatchHistory   Fetch + save via API (Turso)
│   └── useBookmarks      localStorage
├── pages/                Astro file-based routing
│   ├── index.astro       Homepage
│   ├── watch/[id]/[episode].astro   SSR player page
│   ├── anime/[id].astro  Anime detail (SSR)
│   ├── search.astro       Search page
│   ├── history.astro      Watch history page
│   ├── bookmark.astro     Bookmarks page
│   ├── genre/[genre].astro Genre page
│   ├── settings.astro     Settings page
│   └── api/              API routes
│       ├── anime/        Proxy ke rodoknai.fun (search, episodes, episode-links, detail, recent)
│       ├── history/      CRUD watch history (Turso)
│       └── proxy-video.ts  DEPRECATED — was 302 redirect to Worker, now unused
├── pages-react/          React page components (hydrated via client:load)
│   ├── WatchPage         Player + episode sidebar + source selector
│   ├── HomePage          Trending + continue watching + new updated
│   ├── AnimeDetailPage   Info + episode list + bookmark
│   ├── HistoryPage       History list + delete
│   ├── BookmarkPage      Bookmark list
│   ├── SearchPage        Search results
│   ├── GenrePage         Genre filter
│   └── SettingsPage      Settings
├── lib/
│   ├── turso.ts          DB client (Turso URL → local SQLite fallback)
│   └── anime-cache.ts    Server-side cache layer (cheerio + R2)
├── layouts/
│   └── Layout.astro      HTML shell + meta
└── theme/
    └── muiTheme.ts       MUI dark theme (cerydra palette)
```

---

## Architecture

### Pages
- `.astro` files = routing & SSR data fetching
- React components hydrated via `client:load` directive in `.astro` templates
- No react-router — plain `<a>` tags or programmatic `navigate()` for navigation
- Watch page (`/watch/[id]/[episode].astro`) does SSR query to Turso for `initialTime` (resume playback)

### Watch Page — Source Auto-Selection
Priority order in `WatchPage.tsx:181-187`:
1. **S-mp4** — highest quality MP4 direct link (requires `directLinks?.length`)
2. **Ok** — any Ok source (including iframe, fewer ads than Mp4)
3. **directLinks** — any source with directLinks array
4. **iframe** — iframe embed (skips Mp4 iframe, too many ads)
5. **player** — last resort (e.g. Yt-mp4)
6. **first available** — whatever is left

`isIframe` is **only** true when `activeSource.type === 'iframe'` AND no directLinks:
```ts
if (!hasDirectLink && activeSource.type === 'iframe') {
  isIframe = true;
}
```
Sources with type `'player'` (like Yt-mp4) are rendered via Vidstack, not iframe.

### Md3VideoPlayer (`src/components/Md3VideoPlayer.tsx`)
Custom MD3-style video player built on Vidstack built-ins + headless hooks:
- **`<MediaPlayer>`** — root component, wraps `<MediaProvider>` + custom chrome
- **`<Controls.Root hideDelay={3000}>`** — Vidstack auto-hide; do not reimplement timers
- **`<Gesture>`** — double-tap seek zones + tap control toggle
- **`<Spinner>`**, **`<PIPButton>`**, **`<Menu>`** — use Vidstack built-ins for buffering, PiP, speed menu
- **`PlayerChrome` / `Md3BottomBar` / `Md3CenterOverlay` / `Md3FullscreenOverlay`** — custom UI inside player context
- **`WaveSeekbar`** (`src/components/WaveSeekbar.tsx`) — SVG straight played line + sine-wave unplayed path + playhead dot
- **Lock button** — sibling of controls inside `<MediaPlayer>`, default unlocked per mount; hides chrome via CSS, not player APIs
- **Autonext** — toggle stored in `localStorage.cerydra_autonext`; navigation handled in `WatchPage.tsx`
- **No DefaultVideoLayout** — fully custom UI with Tailwind

### Database (Turso + Local SQLite)
`src/lib/turso.ts`:
```ts
const url = getEnv('TURSO_DB_URL') || 'file:local.db';
```
- `import.meta.env.TURSO_DB_URL` prioritized (Astro SSR)
- Falls back to `process.env`, then `'file:local.db'` for dev without Turso
- `pnpm migrate` creates table: `watch_history` (anime_id, episode, current_time, duration, etc.)

**API History (`/api/history`):**
- `GET /api/history` — all entries, newest first
- `POST /api/history` — upsert (body: animeId, animeName, episode, ...)
- `POST /api/history?_method=delete` — delete (single `animeId` or batch `ids[]`)
- Composite key: `anime_id|episode` with pipe `|` separator (not `-`, because anime IDs like `naruto-123` would break)

### Key Components

| Component | File | Role |
|-----------|------|------|
| `AppShell` | `AppShell.tsx` | Bottom nav bar + layout wrapper |
| `Md3VideoPlayer` | `Md3VideoPlayer.tsx` | Custom video player with snake seekbar |
| `WatchPage` | `WatchPage.tsx` | Full watch page: player + episode list + progress |
| `AnimeDetailPage` | `AnimeDetailPage.tsx` | Anime info + episode list + bookmark |
| `ContinueWatchingRow` | `ContinueWatchingRow.tsx` | History-based row on homepage |
| `AnimeCard` | `AnimeCard.tsx` | Poster card component |
| `HeroCarousel` | `HeroCarousel.tsx` | Trending carousel on homepage |
| `useWatchHistory` | `hooks/useWatchHistory.ts` | Fetch/save/delete history via API |

---

## Design System

See `DESIGN.md` for visual spec (colors, typography, components) and `PRODUCT.md` for product strategy.

**Key tokens:**
- Background: `#0B0E1A` (Deep Navy), Surface: `#141A2E` (Storm Gray)
- Primary accent: `#3DD9E0` (Cyan Pulse) — ≤5% of screen
- Text: `#EAF2F7` (Frost White), Muted: `#9FB3CC` (Arctic Fog)
- Inter font throughout, single-weight hierarchy
- Flat surfaces, hover lift (scale 1.03 + cyan border)

---

## Known Gotchas

### Astro v6 CSRF
- Raw `DELETE` requests are blocked by Astro v6 CSRF protection
- Workaround: `POST /api/history?_method=delete` with JSON body
- Applied in `useWatchHistory.ts` (removeEntry, removeEntries, clearHistory)
- Applied in `src/pages/api/history/index.ts` (checks `url.searchParams.get('_method')`)

### Pipe Separator for Composite Keys
- History composite key is `animeId|episode` (pipe separator)
- Dash `-` separator would break on anime IDs like `naruto-123`
- Both `WatchPage.tsx` and `HistoryPage.tsx` use `split('|')`

### Md3VideoPlayer Context Requirement
- `Md3Controls` MUST be a child of `<MediaPlayer>` to access Vidstack context
- `useMediaStore()`, `useMediaRemote()`, `useMediaPlayer()` only work inside `<MediaPlayer>`
- `remote.seek()`, `remote.play()`, `remote.enterFullscreen()` dispatch DOM events that bubble to the player element
- Do NOT use native DOM APIs (`container.requestFullscreen()`) — always use Vidstack `remote`

### `MediaTimeUpdateEventDetail`
- Vidstack v1 `timeUpdate` event detail has `{ currentTime, played }` — **no `duration`** property
- Use `useMediaStore().duration` instead

### `navigate()` vs `window.location.href` for ClientRouter
- Astro `ClientRouter` intercepts `<a>` clicks for view transitions — but `window.location.href` bypasses it entirely, causing full page reloads + destroying persisted components (GlobalPlayer)
- **Always** use programmatic `navigate()` from `astro:transitions/client` for internal navigation:
  ```ts
  const { navigate } = await import('astro:transitions/client');
  navigate(url);
  ```
- Dynamic import ensures it only runs in the browser (avoid SSR issues)
- Used in: `AnimeCard.tsx`, `HistoryPage.tsx`, `HomePage.tsx`, `HeroCarousel.tsx`, `TopRatedAnime.tsx`, `WatchContent.tsx`, `LibraryPage.tsx`, `AnimeInfoModal.tsx`, `SeasonalPage.tsx`
- Do NOT add new `window.location.href` calls for internal routes — use `navigate()` instead

### proxy-video.ts — 302 Redirect Only
- Does NOT stream videos anymore — just validates the `url` param and redirects to Cloudflare Worker
- DEPRECATED: Vidstack `<video>` element doesn't handle 302 redirect correctly (browser video fails to load)
- Worker URL: `https://cerydra-video-proxy.wingky530-id.workers.dev/`
- Now unused: `WatchContent.tsx` sets `activeUrl` directly to Worker URL, skipping proxy-video entirely
- DEV mode uses BigBuckBunny.mp4 sample in WatchContent.tsx
- Worker handles actual video streaming, R2 caching, Queue-based background caching

### Server (rodoknai.fun) Returns `sourceName` Values
```
S-mp4, Mp4, Ok, Yt-mp4, Default, Ss-Hls, Sl-mp4, Fm-Hls, Uni, Vg, Sw
```
Source priority ranking is by `sourceName` (string match), not by `type`.

---

## Developer Environment

- **Device:** Android phone (Termux) — no desktop/laptop
- **Limitations:** No browser DevTools console, rely on terminal logs
- **Debugging:** `console.log()` in React components shows in terminal `pnpm dev` output
- Browser testing via `pnpm dev` on LAN (Vite exposes on network by default)

---

## AI Preferences

- Use thinking efficiently — don't get stuck in loops
- Reference `AGENTS.md`, `DESIGN.md`, `PRODUCT.md` before making architectural changes
- For small visual tweaks (colors, spacing, margins), apply directly without build
- Only build/push when requested or for functionally significant changes
- After significant project changes, update `AGENTS.md` to reflect new state
- Keep edits scoped and minimal
- **Language Requirements**: All UI components, buttons, placeholders, empty states, and user-facing text MUST be written in **English**. Do not use Indonesian for UI text unless explicitly requested by the user.

## Git Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructure
- `style:` — formatting/styling only
- `docs:` — documentation
- `chore:` — build/config/tooling

Messages in English, present tense, lowercase after type.

## Agent Boundaries

| | Action |
|---|---|
| ✅ **Always** | Read file before editing · Reference AGENTS/DESIGN/PRODUCT.md · Update docs after significant changes |
| ⚠️ **Ask first** | Adding dependencies · Modifying `astro.config.mjs` · Changing design tokens · Structural refactors |
| 🚫 **Never** | Commit secrets or API keys · Edit `node_modules/` · Use native DOM fullscreen API in Md3VideoPlayer · Create "AI Slop" designs (see rules below) |

## Anti-AI-Slop Rules
1. **NO Glassmorphism Spam:** Do not arbitrarily use `backdrop-blur-md` with semi-transparent white/black backgrounds (`bg-white/10`, `bg-black/35`) for simple UI components like icon buttons. 
2. **Standardize Icons:** Use strictly MD3-style solid filled or outline icons. Do not create complex composed SVG structures (like fake toggle switches inside buttons) unless they directly mimic standard native UI components.
3. **Consistent Interactive States:** For icon buttons, stick to the established standard: unselected (`text-white/60 hover:text-white hover:bg-white/10`) and selected (`text-[#3DD9E0]`). No random pills, backgrounds, or complex transitions for basic states.
4. **Shadows:** Use shadows purposefully for elevation/depth, not indiscriminately for glowing effects unless it's a primary CTA.
5. **No AI-Slop Empty States:** Empty states should be clean, flat, and simple (MD3 compliant). Avoid excessive glowing gradients (`blur-3xl animate-pulse`), drop shadows (`drop-shadow-2xl`), gradient SVG strokes, or glowing buttons. Use a simple surface-colored circle/box with a solid standard icon, and a simple contained button.
