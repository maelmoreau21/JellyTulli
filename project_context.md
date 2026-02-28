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
