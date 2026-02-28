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
  - Integration of **API-Based External Migrations** from `Jellystat` and the `Playback Reporting` plugin. By communicating directly and securely via backend HTTP requests, the application safely builds an iterative Sync Pipeline preventing OOM crashes on small edge devices like Raspberry Pi. The system automatically fetches and parses the CSV exports natively.
  
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
