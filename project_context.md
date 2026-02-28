# JellyTulli - Project Context & Architecture

**Description** : JellyTulli (Jellyfin + Tautulli) est un wrapper analytique et un traceur autonome ("Ultimate Dashboard 2.0") pour Jellyfin.

## Tech Stack
- Frontend/Backend: **Next.js 15+ (App Router, Server Components)**
- Cache en temps réel: **Redis (ioredis)**
- DB et ORM: **PostgreSQL + Prisma**
- Styling: **TailwindCSS + Shadcn/UI + Lucide Icons**
- DataViz: **Recharts**
- IP Localization: **geoip-country**

## Phase 3 : Tautulli Ultimate Clone Capabilities
A massive analytical refactoring was introduced focusing on Data Context and Resilience on Edge Devices (Raspberry Pi).

1. **Dashboard Tab Layout (`page.tsx`)**:
  - Encapsulated by `Tabs` (Vue d'ensemble / Analyses Détaillées).
  - Heavy JS tasks partitioned within `<Suspense>` via `DeepInsights` and `GranularAnalysis`.
  
2. **Deep Insights (`DeepInsights.tsx`)**:
  - Leverages massive raw grouped data.
  - Computes `Top 5 Films`, `Top 5 Series`, `Top 5 Music`, `Top 5 Books`.
  - Determines top Playback Clients.
  - Stream Proportions visually handled via `StreamProportionsChart.tsx` (Direct vs. Transcode).

3. **Granular Analysis (`GranularAnalysis.tsx`)**:
  - 6 dedicated charts to handle grouped historical context using `StandardMetricsCharts` wrappers.
  - **Daily**: Raw Plays vs Collections ; Raw Durations vs Collections.
  - **Hourly Heatmap Equivalent**: Bar / Area grouping plays according to Hour (`00h` to `23h`).

4. **Dynamic Data Engine**:
  - Time Range Selector now contains a `React-Day-Picker` Custom scope.
  - Query endpoints and URL `searchParams` accept `?from=YYYY-MM-DD&to=YYYY-MM-DD`.

5. **Universal Security & Backups & External Migrations (`src/app/api/backup`)**:
  - Zero-Constraint JSON architecture backing up all `Users`, `Media`, `Settings`, and `Logs`.
  - Import leverages Prisma `$transaction` with a timeout of 60000ms. If one line is corrupted, the DB rolls back safely.
  - Integration of **Chunked File Migrations** from `Jellystat` (JSON) and the `Playback Reporting` plugin (CSV). The application handles these uploads via Buffers and streams to process massive imports iteratively (e.g., 500 records at a time), preventing OOM crashes on edge devices like Raspberry Pi.
  
6. **Autonomy Core (`src/server/monitor.ts`) & Docker Strategy**:
  - The heartbeat pulls from `[GlobalSettings.jellyfinUrl]/Sessions` directly from the database configuration.
  - Build pipeline relies on `output: "standalone"` making it highly effective structurally.

7. **Security & Setup (Phase 5)**:
  - Global `GlobalSettings` database configuration completely replaced `.env` variables (`JELLYFIN_URL`, `JELLYFIN_API_KEY` and `DISCORD_WEBHOOK_URL` have been strictly deleted from the codebase and Docker).
  - Implements a Setup Wizard (`/setup`) upon first boot, preventing crashes by redirecting unconfigured instances directly.
  - Jellyfin-Native Authentication via NextAuth `CredentialsProvider` calling `/Users/AuthenticateByName` enforcing `Policy.IsAdministrator`.
  - Next.js Middleware protects all analytical routes. Local `signOut` directly routes to `/login` via JS to bypass strict callbackUrl environment constraints.

8. **Elite Features (Phase 6)**:
  - **Jellyfin Native Webhooks**: `/api/webhook/jellyfin` endpoint securely traps `PlaybackStart` events for real-time Discord Alerts without polling.
  - **Yearly Heatmap**: Github-style 365-day contribution chart tracking user activity density efficiently.
  - **Newsletter Generator**: `/newsletter` standalone responsive A4-sized report aggregating the month's biggest viewers and top videos with visually immersive backdrops.
  - **Draggable Dashboard**: Utilizes a persistent `localStorage` layout state and a React wrapper `DraggableDashboard` to rearrange Server Components instantly via up/down controls in the UI.

56. 9. **Elite Features: Wrapped, Clean-up & Advanced Stats (Phase 8)**:
57.   - **JellyTulli Wrapped**: `/wrapped/[userId]` portal dynamically calculating each user's year in review (Total Watch Time, Top 3 Media, Favorite Genre, Most Active Day). Presented in a modern Instagram/Spotify Story format.
58.   - **Administrator Clean-up Assistant**: `/admin/cleanup` routing featuring a Tabular Dashboard for detecting *Ghost Media* (added >30 days ago, 0 plays) and *Abandoned Media* (started but with <80% average completion rate).
59.   - **Granular Drop-off Stats**: Detailed Analytics tab now renders average completion rates per library (Movies, Series, Music).
60.   - **Peak Concurrent Streams KPI**: Dashboard natively plots historic `PlaybackHistory` overlap using timeline events to calculate the absolute peak concurrent stream load since database origin.
61. 
66.   - **Funnel segmentation**: Deep dive inside the UX by detecting behaviors like: Zapped (<10%), Tried (10-25%), Halfway (25-80%), Finished (>80%). Coupled with dynamic PieCharts for VF/VO and SRT breakdown.
67. 
68. 11. **Large File Support & Streaming Imports (Phase 10)**:
   - **Advanced Configuration**: Next.js `bodySizeLimit` increased to `500mb` via `experimental` settings to handle mass exports.
   - **TSV Support**: Playback Reporting migration now natively handles `.tsv` and `.csv` via automatic delimiter detection in PapaParse.
   - **Memory-Efficient Streaming**: Jellystat JSON import (up to 174MB+) rewritten using `stream-json` and `stream-chain`. Records are parsed one by one from the stream and processed in chunks of 200, preventing RAM exhaustion on edge devices like Raspberry Pi.

12. **Critical Bug Fixes (Phase 11)**:
   - **Jellystat Import 174MB Fix**: Server Actions also enforce the 10MB limit on the `/settings` page path in Docker. Reverted to a **Route Handler** (`/api/backup/import/jellystat`) with the client sending the raw `File` blob via `fetch()` with `Content-Type: application/octet-stream`. The Route Handler streams `req.body` directly into `stream-json` — zero buffering, no body parsing, no size limit. `serverExternalPackages: ['stream-json', 'stream-chain']` added to `next.config.ts` to ensure proper bundling. The Server Action file (`src/app/actions/import-jellystat.ts`) is kept as reference but no longer invoked.
   - **Playback Reporting TSV Fix**: The Playback Reporting TSV export has **no header row** — the first line is already data. PapaParse now uses `header: false` and the mapping is done by **column index**: `[0]:Date [1]:UserId [2]:ItemId [3]:ItemType [4]:ItemName [5]:PlayMethod [6]:ClientName [7]:DeviceName [8]:PlayDuration`. Diagnostic `console.log` logs the first row sample and column count. UI text updated from "CSV" to "TSV" throughout the settings page.
   - **Unknown User Fix**: Users imported from the TSV that don't exist locally are now created with username `"Utilisateur Supprimé"` instead of `"Unknown User"`. Their real name is resolved on the next Jellyfin sync.
   - **Logout Redirect Fix**: `signOut({ callbackUrl: '/login' })` replaced by `await signOut({ redirect: false })` followed by `window.location.href = '/login'`. This forces a pure JS redirect that always uses the current host, eliminating the `localhost:3000` redirect bug caused by NextAuth's `callbackUrl` resolution.

13. **UUID Normalization, Chunked Upload & Auto-Backups (Phase 12)**:
   - **UUID Normalization**: Playback Reporting TSV exports IDs without dashes (32 hex chars). A `normalizeUuid()` function now adds standard UUID dashes (8-4-4-4-12) before upsert, ensuring imported users correctly match existing Jellyfin users in the database.
   - **Logs CSS Overflow Fix**: Media title column in `/logs` now uses `max-w-[150px] md:max-w-[250px]` with `truncate` to prevent long titles from overflowing into adjacent columns.
   - **Chunked Upload (Jellystat 174MB)**: Client-side `File.slice()` splits the JSON into 5MB chunks sent sequentially to `/api/backup/import/jellystat/chunk`. Each chunk is saved to `/tmp/jellytulli-uploads/{uploadId}/`. A `/api/backup/import/jellystat/finalize` endpoint merges all chunks then pipes the merged file through `stream-json` for incremental DB import. Progress bar displayed in the UI (0-50% upload, 55-100% processing).
   - **Auto-Backup System**: `node-cron` task in `instrumentation.ts` triggers `performAutoBackup()` at 3:30 AM daily. The function (`src/lib/autoBackup.ts`) exports all Users, Media, PlaybackHistory and Settings to `/data/backups/jellytulli-auto-YYYY-MM-DD_HH-MM-SS.json`. Rolling rotation keeps only the 5 most recent files. A Docker named volume `jellytulli_backups` persists the backups across container rebuilds.
   - **Auto-Backup UI**: New card in `/settings` lists the 5 auto-backups with date, size, and a "Restaurer" button. Restore endpoint (`/api/backup/auto/restore`) reads the file from disk and replays it via Prisma `$transaction` with full cascade (delete → recreate all tables).

14. **DB Pool Fix, Jellystat Parser, RBAC & Extended Wrapped (Phase 13)**:
   - **Prisma Pool Exhaustion Fix**: The singleton pattern in `src/lib/prisma.ts` now assigns `globalThis.prismaGlobal = prisma` unconditionally (not just in development). This prevents "Too many clients already" errors in production Docker. Added `log: ['error']` in production and `['warn', 'error']` in development. `DATABASE_URL` in `docker-compose.yml` now includes `&connection_limit=5` to cap Prisma's pool size on Raspberry Pi.
   - **Jellystat JSON Auto-Detection**: Jellystat exports can be either a root-level JSON array `[...]` or an object like `{"jf_playback_activity": [...]}`. Both the direct import route (`/api/backup/import/jellystat`) and the chunked finalize route (`/api/backup/import/jellystat/finalize`) now auto-detect the structure by peeking at the first bytes. If the root is an object, `pick({ filter: detectedKey })` from `stream-json/filters/Pick` is injected into the pipeline before `streamArray()`. This fixes the "0 sessions imported" bug.
   - **Logs CSS Table-Fixed**: `<Table>` in `/logs` now uses `table-fixed` class with explicit column widths (`w-[130px]` Date, `w-[120px]` User, `w-[250px]` Media, etc.). Media cell uses `overflow-hidden` + `min-w-0` flex children for proper truncation.
   - **RBAC (Admin vs User)**: Jellyfin's `Policy.IsAdministrator` is no longer gate-checked at login — ALL Jellyfin users can now authenticate. The `isAdmin` boolean and `jellyfinUserId` are stored in the JWT via NextAuth `callbacks.jwt` and exposed on the session via `callbacks.session`. Type augmentation in `src/types/next-auth.d.ts`. The middleware (`src/middleware.ts`) checks `token.isAdmin`: admins access all routes, non-admins are restricted to `/wrapped/*` only and get redirected to `/wrapped/{jellyfinUserId}` if they try to access admin routes.
   - **Extended Wrapped Page**: The `/wrapped/[userId]` page now computes per-category breakdowns (Movies, Series, Music) with Top 3 media and total hours for each. Three new slides added to the story-style UI: "Le Grand Écran" (Films, red gradient), "Binge Watching" (Series, sky gradient), "La Bande Son" (Music, green gradient). Each slide shows category hours + ranked Top 3 with individual watch durations. The final share card also displays the category breakdown.

15. **Duck-Typing Parser, Tooltips & NextAuth RBAC (Phase 14)**:
   - **Jellystat Duck-Typing Parser**: The `streamArray()` + `pick()` approach was fragile — it required knowing the exact JSON structure. Replaced with `streamValues()` which emits EVERY value at any depth. A duck-typing function `isSessionObject()` checks if each value has `UserId` AND `ItemId` AND (`PlayDuration` OR `RunTimeTicks` OR `DateCreated`). Non-session values are silently skipped. Applied to both direct import (`/api/backup/import/jellystat`) and chunked finalize route. This guarantees import regardless of Jellystat's internal JSON key naming.
   - **Playback Reporting UUID Fix**: `normalizeUuid()` now lowercases the entire ID and validates it with `/^[0-9a-f]{32}$/` before inserting dashes. The variable is extracted and normalized IMMEDIATELY from `row[1]` before any Prisma call. A diagnostic log prints the before/after UUID for the first processed row.
   - **Logs Tooltip**: Added `title={log.media.title}` on the parent `<div>` wrapping the media cell in `/logs`. The native HTML `title` attribute displays the full media name on hover, complementing the CSS `truncate`.
   - **RBAC Session Fix**: `session.user.isAdmin` and `session.user.jellyfinUserId` are now exposed on `session.user` (not `session` root). Type declarations updated in `src/types/next-auth.d.ts` to extend `DefaultSession["user"]`.
   - **Dashboard Admin Guard**: `page.tsx` (Dashboard) now calls `getServerSession(authOptions)` and checks `session.user.isAdmin`. Non-admins are server-side redirected to `/wrapped/{jellyfinUserId}` via `redirect()`.
   - **API Route Protection**: Middleware now explicitly blocks non-admin access to `/api/sync`, `/api/backup`, `/api/hardware`, `/api/settings`, and `/api/admin/*` with a 403 JSON response.

16. **JSONStream Deep Scan, Ghost User Fix & Wrapped RBAC (Phase 15)**:
   - **JSONStream Deep Scan**: `stream-json` `streamValues()` emitted the entire root JSON as ONE value — it never recursed into nested objects, causing 0 sessions imported from Jellystat. Replaced with `JSONStream.parse('..')` which recursively emits every object/value at every depth. The `isSessionObject()` duck-typing filter is preserved. Applied to both direct import (`/api/backup/import/jellystat`) and chunked finalize route. Uses event-based `data`/`end` listeners with `pause()`/`resume()` for backpressure. `JSONStream` added to `serverExternalPackages` in `next.config.ts`. No `@types/JSONStream` exists — uses `require()` import.
   - **Ghost User Cleanup**: Playback Reporting import now runs a batch `updateMany` at the end of each import to fix all users with username `"Unknown User"` / `"Unknown"` → `"Utilisateur Supprimé"`. This retroactively fixes ghost users created before the Phase 11 naming fix.
   - **Wrapped Page RBAC Fix**: Sidebar (`Sidebar.tsx`) now hides on `/wrapped/*` paths (not just `/login`), giving non-admin users a clean fullscreen Wrapped experience. Middleware matcher broadened from `_next/static|_next/image` to `_next` to exclude ALL Next.js internal routes, preventing potential interference with RSC payloads and other internal fetches.

17. **JSON Case-Insensitive Parser, Local DB Fallback & User RBAC (Phase 16)**:
   - **Jellystat Case-Insensitive Duck-Typing**: Keys in Jellystat JSON exports vary wildly (`UserId`, `userId`, `user_id`). Both import routes now call `toLowerKeys(obj)` to normalize ALL keys to lowercase before testing `isSessionObject()` and before extracting field values in `processChunk()`. Condition: `lk.userid && (lk.itemid || lk.nowplayingitemid) && (lk.playduration || lk.runtimeticks)`. A diagnostic `console.log("Exemple d'objet trouvé:", Object.keys(obj))` logs the raw keys of the first scanned object for troubleshooting. Default username in Jellystat import changed from `"Unknown User"` to `"Utilisateur Supprimé"`.
   - **Ghost User Cleanup (All Import Routes)**: All three import routes (Jellystat direct, Jellystat finalize, Playback Reporting) now run `prisma.user.updateMany()` at completion to batch-rename users with `"Unknown User"` / `"Unknown"` → `"Utilisateur Supprimé"`.
   - **Local DB Username Fallback**: All display components (Logs, Users leaderboard, User detail, Dashboard top users, Wrapped) now strictly use `user.username || "Utilisateur Supprimé"` from the local Prisma database. No external Jellyfin API calls for username resolution. This ensures deleted Jellyfin users always display a meaningful name.
   - **Middleware RBAC Restructure**: Middleware changed from a whitelist model (only `/wrapped` + `/api/auth` allowed for non-admins) to a blacklist model. New structure: `PUBLIC_USER_PATHS` = `/wrapped`, `/api/auth`, `/api/jellyfin`; `ADMIN_API_PATHS` = `/api/sync`, `/api/backup`, `/api/hardware`, `/api/settings`, `/api/admin`; `ADMIN_PAGE_PATHS` = `/`, `/logs`, `/users`, `/media`, `/newsletter`, `/admin`, `/settings`. Non-admin users can now access any route not explicitly blocked, while admin pages redirect to `/wrapped/{id}` and admin APIs return 403.
   - **Wrapped Auto-Create User**: The `/wrapped/[userId]` Server Component now auto-creates the user in Prisma if they authenticated via Jellyfin but were never synced/imported. Uses `getServerSession()` to verify the requested userId matches the logged-in user before creating. This prevents 404 errors for newly-registered non-admin users accessing their Wrapped page.

18. **Watch Party, Network Dashboard & Pro Telemetry (Phase 17)**:
   - **Watch Party Detection**: `/logs` page now runs a `detectWatchParties()` algorithm after fetching PlaybackHistory. Groups sessions of the same media (same `mediaId`) started by different users within a 5-minute window. Each detected party renders a gradient banner row in the table with `🍿 Watch Party` badge showing the number of spectators and their usernames. Party member rows are visually marked with a violet left border and a `Users` icon next to the date. Custom `animate-pulse-slow` CSS animation (3s cycle) for the banner.
   - **Network Dashboard Tab**: New "Réseau" tab added to the Dashboard page alongside "Vue d'ensemble" and "Analyses Détaillées". Powered by a `NetworkAnalysis` async Server Component (`src/components/dashboard/NetworkAnalysis.tsx`) loaded via `<Suspense>`. Contains:
     - **Stats Row**: 4 KPI cards (Total Sessions, Transcode Rate %, DirectStream count, Transcoded Duration in hours).
     - **DirectPlay vs Transcode AreaChart**: `TranscodeHourlyChart` (`src/components/charts/TranscodeHourlyChart.tsx`) — stacked area chart showing DirectPlay/DirectStream/Transcode session counts by hour of day (00h-23h). Interactive legend toggling.
     - **Client Transcode Profile**: Horizontal bar chart showing transcode % per client application.
     - **"Table des Coupables"**: Top 10 most transcoded media with resolution badge, session count, total duration, inferred cause (Subtitle Burn-in, HD Audio unsupported, 4K resolution, Client compatibility), and the primary client responsible. Causes are inferred from `subtitleCodec` (burn-in codecs: ass/ssa/pgssub/dvdsub), `audioCodec` (heavy: truehd/dts/eac3/flac), and `Media.resolution`.
   - **Pro Telemetry (Deep Insights)**: Two new donut charts added to the "Analyses Détaillées" tab in `DeepInsights.tsx`:
     - **Resolution Matrix**: Joins `PlaybackHistory → Media.resolution` to show sessions by resolution (4K, 1080p, 720p, SD, Unknown). Top 6 values displayed.
     - **Device Ecosystem**: Groups `PlaybackHistory.deviceName` to display the top 8 physical playback devices (distinct from the existing `PlatformDistributionChart` which tracks `clientName`).

19. **Import Resilience, Jellystat Relaxed Scan & Wrapped RBAC (Phase 18)**:
   - **PlaybackHistory.userId Optional**: Schema changed `userId` from `String` (required) to `String?` (optional). `user` relation changed from `User` to `User?`. `onDelete: Cascade` preserved — deleting a User still removes their history, but orphan records (null userId) are allowed. Requires `npx prisma migrate dev` or `npx prisma db push`.
   - **Playback Reporting TSV: No Ghost Users**: `prisma.user.upsert()` replaced by `prisma.user.findUnique()`. If the UUID from TSV doesn't match any existing User, the PlaybackHistory is created with `userId: null` and `clientName` tagged with `"(Utilisateur Inconnu - TSV)"`. This prevents phantom User records from being created during import. De-duplication via `findFirst` still works with null userId.
   - **Dashboard Null Guard**: `topUsersAgg` groupBy query now includes `userId: { not: null }` filter to prevent null userId from breaking the subsequent `findUnique({ where: { id: agg.userId } })`.
   - **Jellystat Relaxed Scan**: `isSessionObject()` duck-typing in both direct import (`/api/backup/import/jellystat`) and chunked finalize route no longer requires `PlayDuration`, `RunTimeTicks`, or `DateCreated`. Simplified criterion: `hasUserId && hasItemId`. This captures sessions from Jellystat exports that omit activity duration fields. Sessions with 0 duration are imported with `durationWatched: 0`.
   - **Jellystat Detailed Logging**: Both Jellystat import routes now log: (1) keys of the first scanned object, (2) full JSON of the first matched session (truncated to 500 chars), (3) keys of up to 3 objects that have a `userId` field but were rejected (missing ItemId). This aids debugging when imports yield 0 sessions.
   - **Wrapped All-Time Fallback**: `/wrapped/[userId]` Server Component now falls back to all-time data when the current year filter yields 0 sessions. Applied to both the initial query and the auto-create re-fetch. Ensures non-admin users with only imported historical data see their Wrapped instead of an empty page.

20. **Brute-Force Imports, RBAC Fix & Media Profiler (Phase 19)**:
   - **Jellystat Brute-Force Regex**: JSONStream deep-scan parser entirely replaced. Both direct import (`/api/backup/import/jellystat`) and chunked finalize route now read the raw file as a UTF-8 string and use `RegExp.exec()` to find all `"UserId":"..."` occurrences. For each match, the enclosing `{...}` JSON object boundaries are found by scanning backward/forward for `{` and `}`. Field values (ItemId, UserName, ItemName, PlayDuration, DateCreated, PlayMethod, ClientName, DeviceName) are extracted via individual case-insensitive regex calls (`extractStr()`, `extractNum()`). Sessions without an ItemId are skipped. This approach handles 174MB single-line JSON files that crash traditional JSON parsers. `JSONStream`, `stream-json`, and `stream-chain` imports removed; `Readable` import removed from the direct route; `createReadStream` replaced by `readFileSync` in the finalize route.
   - **Middleware RBAC Overhaul**: Switched from a broad blacklist model blocking many routes for non-admins to a minimal restriction. `ADMIN_API_PATHS` reduced to `["/api/admin"]` only. `ADMIN_PAGE_PATHS` reduced to `["/admin", "/settings"]`. The `PUBLIC_USER_PATHS` concept removed entirely. Non-admin users can now access `/`, `/logs`, `/users`, `/media`, `/newsletter`, and all non-admin API routes. Pages like the Dashboard (`/`) have their own server-side `isAdmin` check and redirect.
   - **Username Display Consistency**: Newsletter page `topUser.name` fallback changed from `"Inconnu"` to `"Utilisateur Supprimé"` for consistency with all other display components.
   - **Media Profile Page (`/media/[id]`)**: New dynamic route analyzing a specific media item. Features:
     - **Header**: Title, Poster (via Jellyfin Image proxy), genres, resolution badge, duration, production year, and community rating fetched from Jellyfin `/Items/{id}` API. Overview/synopsis displayed with `line-clamp-5`.
     - **KPI Cards**: Total watch time (hours), total views (session count), average duration per session (minutes).
     - **Télémétrie & Drop-off**: `MediaDropoffChart` client component renders a Recharts BarChart with 10 buckets (0-10%, 10-20%, ..., 90-100%) showing session completion distribution. Color gradient from red (early drop-off) to green (completed). Based on `durationWatched / (media.durationMs / 1000)`.
     - **Historique Détaillé**: Full table of every playback session — user (linked to `/users/[jellyfinUserId]`), date, play method (DirectPlay/Transcode badge), audio language + codec, subtitle language + codec, and duration watched.
   - **Media Grid Navigation**: Media cards in `/media` now wrapped in `<Link>` to `/media/{jellyfinMediaId}`, making each card clickable to its profile page.
