---
description: "Instructions et memoire pour agents IA - JellyTrack v1.5.0"
paths:
  - "."
  - "src/**/*.ts"
---

# JellyTrack - Instructions & Memoire Agents IA (v1.5.0)

IMPORTANT - lire integralement ce document avant toute modification.

- Ne pas halluciner la structure de donnees: verifier systematiquement `prisma/schema.prisma`.
- Ne pas halluciner les cles i18n: verifier `messages/*.json`.
- Ne pas inventer de contrat plugin: verifier `src/app/api/plugin/events/route.ts`.
- Ne pas faire de `commit`, `push`, creation de branche ou `merge` sans demande explicite utilisateur.
- Le mode d'installation principal reste Docker (`docker-compose.yml`).
- Le fichier `.env` est public et versionne comme exemple: placeholders uniquement (`CHANGE_ME_*`), jamais de secrets reels.

## 1. Stack Technique Canonique

- Framework: Next.js 16 App Router (`src/app/`)
- Langage: TypeScript strict
- Auth web: next-auth avec proxy Next (`src/proxy.ts`)
- ORM/DB: Prisma + PostgreSQL
- Cache/temps reel: Redis (ioredis)
- UI: Tailwind + composants `src/components/ui/*`
- Graphiques: Recharts
- i18n: next-intl + fichiers `messages/*.json`

## 2. Architecture Securite v1.5.0 (reference)

### 2.1 Plugin API Key - Hash-at-Rest
Source: `src/lib/pluginKeyManager.ts` + `src/app/api/plugin/events/route.ts`
- La cle plugin est stockee sous forme de hash scrypt versionne (`s1$...`).
- Toute modification des settings plugin via l'UI (`JellyfinServersSettings.tsx`) se concentre sur la **generation** de nouvelles cles. L'UI ne permet plus de coller manuellement une cle brute pour eviter les erreurs humaines et renforcer la securite.

### 2.2 Audit & Logs
Source: `src/lib/adminAudit.ts` + `src/app/logs/page.tsx`
- **Audit de Connexion** : Chaque connexion reussie est enregistree via `writeAdminAuditLog` dans `authOptions.ts`.
- **Filtrage des Logs** : Les logs de type `monitor_ping` (heartbeats) sont désormais filtres au niveau de la requete Prisma dans `logs/page.tsx` pour ne pas polluer l'interface. Ils restent stockes en DB mais sont invisibles dans l'onglet "Système" par defaut.

### 2.3 Branding & Logo
- Le logo officiel est `public/logo.svg`.
- Pour une fiabilite maximale (eviter les problemes de chargement de fichiers statiques sur la page de login), le code SVG est **inclus directement (inlined)** dans `src/app/login/page.tsx` et `src/components/Sidebar.tsx`.

## 3. Arborescence de Travail (vue utile)

- `src/app/*`: pages/routes App Router
- `src/app/api/*`: APIs serveur
- `src/proxy.ts`: politique d'acces globale
- `src/lib/*`: logique metier (auth, sync, plugin key, SSRF/webhook, server registry)
- `src/components/ui/*`: primitives UI a reutiliser en priorite
- `src/components/dashboard/*`: blocs dashboard
- `src/components/charts/*`: wrappers recharts
- `prisma/schema.prisma`: source de verite du modele
- `messages/*.json`: traductions multi-locales

## 4. Prisma - Resume Canonique (v1.5.0)

Modeles cles:
- `Server`: `id`, `jellyfinServerId`, `name`, `url`, `jellyfinApiKey`, `isActive`.
- `User`: `serverId`, `jellyfinUserId`, `username`, `lastActive`.
- `Media`: `serverId`, `jellyfinMediaId`, `type`, `collectionType`, `libraryName`.
- `PlaybackHistory`: `serverId`, `userId`, `mediaId`, `playMethod`, `startedAt`, `endedAt`.
- `AdminAuditLog`: Historique des actions sensibles (connexions, modifications settings).
- `SystemHealthEvent`: Evenements de sante (sync, plugin connection). *Note: `monitor_ping` est le type dominant ici.*

## 5. I18n - Politique Obligatoire

- Toute chaine UI doit venir de `messages/*.json`.
- **Modification Recente** : La cle `sortDateDesc` dans `logs` a ete renomee en "Trier" pour optimiser l'espace UI dans le selecteur de tri.

## 6. Regles Qualite Zero Dette Technique

Avant finalisation:
1. Verifier les impacts schema si code data modifie.
2. Verifier les traductions sur toutes locales.
3. Executer `npm run build`.
4. Verifier que le logo inlined est present si une modification est faite sur le header/login.

---
Ce document est la reference agents IA pour JellyTrack v1.5.0.
Toute evolution structurelle doit mettre a jour ce fichier.