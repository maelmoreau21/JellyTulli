# JellyTulli - Project Context

## Objectif
Développer "JellyTulli", une solution de monitoring et d'analytique avancée pour Jellyfin, conçue pour supporter une forte charge. Elle se veut supérieure à Jellystat (historique profond, analyse avancée du transcodage, géolocalisation IP, alertes).

## Architecture & Stack Technique
- **Infrastructure** : Docker Compose (App, PostgreSQL 18, Redis)
- **Base de données** : PostgreSQL 18 (stockage persistant des métriques et historique) via Prisma
- **Cache & Temps Réel** : Redis (pour le stockage des flux en cours, des requêtes très fréquentes et la communication temps réel)
- **Backend / API** : Node.js 20-alpine (via Next.js Server Actions / API Routes), Prisma
- **Frontend** : Next.js (React), Tailwind CSS, Shadcn/UI pour les graphiques avancés et l'interface

## Fonctionnalités Principales Attendues
1. **Monitoring 100% Autonome (Zero-Config)** :
   - Plus besoin du plugin Webhook. JellyTulli sonde les sessions API toutes les 5s.
   - Analyse du transcodage (codec vidéo/audio, fps de transcodage, bitrate)
   - Suivi rapide via Redis pour soulager la base PostgreSQL
2. **Statistiques Poussées & Dataviz Recharts** :
   - Graphiques d'activité (Temps de lecture 7J, Répartition des pics horaires d'utilisation).
   - Écosystème des clients (PieChart des plateformes).
   - Classement (Leaderboard) des Top 5 Utilisateurs par temps de visionnage.
   - Dataviz Bibliothèque : Top Genres et Résolution Globale (4K, 1080p).
   - Métriques Temps Réel : Efficacité DirectPlay 24h & Bande Passante sortante estimée.
3. **Géolocalisation & Identification Clients** :
   - Tracking des IP via GeoIP (pays, ville)
   - Identification précise de l'appareil et du navigateur
4. **Synchronisation Multi-tâches** :
   - Job asynchrone pour synchroniser les bibliothèques et utilisateurs depuis Jellyfin sans bloquer les performances de l'API.

## Règles Absolues
- **Ce fichier (project_context.md) DOIT être lu avant toute action.**
- Ce fichier doit être mis à jour à chaque modification majeure de l'architecture, de la BDD ou des fonctionnalités pour éviter les hallucinations et garder une base documentaire fiable.

## UI/UX Design System
- **Global Theme:** Enforced a polished "Dark Mode" aesthetic across the entire layout using `bg-zinc-950`, `text-zinc-50`, and specialized responsive structural variables.
- **Grids & Images:** Replaced legacy list views with rich visual Grids (`grid-cols-2` to `grid-cols-6`) for media displays. Jellyfin posters enforce strict `aspect-[2/3]` and `object-cover` ratios for clean alignment without overflow, enhancing the premium feel.

## Structure du Projet (Actualisée)
```
/
├── docker-compose.yml        # Définition de l'infrastructure Docker (App Standalone + DB + Redis) et Variables (DATABASE_URL, JELLYFIN...)
├── Dockerfile                # Serveur Next.js multi-stage "standalone" optimisé (Node 20)
├── docker-entrypoint.sh      # Script bash de lancement avec push Prisma automatisé
├── prisma/
│   └── schema.prisma         # Modèle de base de données PostgreSQL
├── src/
│   ├── app/                  # Routes et pages Next.js
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/route.ts # Route NextAuth (Authentification)
│   │   │   ├── jellyfin/
│   │   │   │   └── image/         # Proxy sécurisé pour les affiches (API Key masquée)
│   │   │   ├── settings/
│   │   │   │   └── route.ts      # Endpoint (GET/POST) gérant les paramètres globaux (ex: Discord)
│   │   │   └── sync/
│   │   │       └── route.ts      # Déclencheur manuel pour syncJellyfinLibrary()
│   │   ├── fonts/            # Polices web (Geist)
│   │   ├── login/
│   │   │   └── page.tsx      # Interface de connexion sécurisée
│   │   ├── logs/
│   │   │   └── page.tsx      # Tableau des journaux bruts (Recherche, IP, Statuts)
│   │   ├── media/
│   │   │   └── page.tsx      # Bibliothèque avec tous les médias (Table interactive & Tris)
│   │   ├── settings/
│   │   │   └── page.tsx      # Page des Paramètres (Client Component avec requêtes Sync)
│   │   ├── users/
│   │   │   └── [id]/         # Route dynamique utilisateurs
│   │   │       └── page.tsx  # Vue détaillée (Stats & Historique complet d'un User)
│   │   ├── globals.css       # Styles globaux (Tailwind + Variables Shadcn)
│   │   ├── layout.tsx        # Layout racine
│   │   └── page.tsx          # Page principale (Server Component - Fetch BDD/Redis)
│   ├── components/           # Composants UI React
│   │   ├── DashboardChart.tsx# Graphique interactif Recharts (Client Component)
│   │   ├── LogoutButton.tsx  # Bouton de déconnexion NextAuth
│   │   ├── Navigation.tsx    # En-tête de navigation unifiée (Client Component)
│   │   └── ui/               # Composants Shadcn générés (Card, Table)
│   ├── lib/                  # Utilitaires
│   │   ├── jellyfin.ts       # Service Jellyfin (récupération des images avec API Key)
│   │   ├── sync.ts           # Logique cœur de synchronisation Jellyfin -> Prisma
│   │   ├── prisma.ts         # Singleton pour le client Prisma
│   │   ├── redis.ts          # Singleton pour le client ioredis
│   │   └── utils.ts          # Utilitaires Tailwind/Shadcn (cn)
│   ├── server/               # Définition des jobs asynchrones, services Jellyfin
│   │   └── monitor.ts        # Polling autonome 5s (Discord Webhooks, BDD, Redis)
│   ├── instrumentation.ts    # Enregistrement des Hooks Next.js (Script node-cron & monitor)
│   └── middleware.ts         # Middleware d'authentification NextAuth protégeant le site
├── components.json           # Configuration Shadcn UI
├── next.config.ts            # Configuration Next.js
├── package.json              # Dépendances du projet (inclut next-auth, lucide-react, lites)
├── project_context.md        # Ce document
├── tailwind.config.ts        # Configuration Tailwind
├── test-webhook.js           # Script de simulation des payloads Jellyfin
└── tsconfig.json             # Configuration TypeScript
```

## Fonctionnalités Principales :
1. **Zéro-Configuration Jellyfin (Monitoring Autonome)** : Scrutateur asynchrone node.js de l'API Jellyfin sans nécessiter de plugin Webhook tiers.
2. **Dashboard Global** : Affiche les métriques clés (Streams Actifs, Total Utilisateurs, Heures visionnées) via Redis et Prisma, et intègre un graphique des lectures journalières.
3. **Tracking Géographique (GeoIP)** : Détermine automatiquement le pays et la ville de chaque lecteur actif pour enrichir l'interface sans requête tierce.
4. **Proxy Affiches Médias** : Sécurise l'affichage des tuiles Jellyfin dans l'appli sans fuite de clé API.
5. **Vue Détaillée Utilisateur** : Permet de consulter l'historique complet, les appareils favoris et le temps total d'un profil Jellyfin spécifique.
6. **Bibliothèque Multimédia** : Répertorie et liste tous les médias synchronisés avec tris dynamiques de leurs performances globales (Popularité, Temps Vu, DirectPlay Ratio).
7. **Sécurité Globale (NextAuth)** : Les pages locales sont strictement verrouillées par un Middleware filtrant et un mot de passe Admin depuis le backend.

### Modèles Prisma
- **User** : Un compte identifié par Jellyfin
- **Media** : Un contenu indexé par le système
- **ActiveStream** : Mappe sur le JSON complet d'une lecture Redis
- **PlaybackHistory** : Archivage profond des sessions terminées
- **GlobalSettings** : Configuration de l'application (URL Discord Webhook, état)

## Features Exclusives (vs Jellystat)
1. **Caching Redis & Next.js Partiel** : Plus de sollicitations de BDD pour les requêtes Live (`revalidate = 0`). Les pages à haute intensité de calcul (Dashboard SQL `groupBy`) utilisent un cache de 60s pour protéger le CPU d'applications légères telles qu'un Raspberry Pi.
2. **Synchronisation Automatique Multi-Data** : Tâche `node-cron` récupérant à la fois les médias de base, leurs **Genres**, et la plus forte **Résolution vidéo (4K/1080p)** via `MediaSources`.
3. **Tracking Géographique (GeoIP Dockerisé)** : Détermine le pays et la ville de chaque lecteur. (Le fichier `.dat` est explicitement copié dans le runner Docker pour parer aux erreurs `ENOENT`).
4. **Proxy Affiches Médias** : Sécurise l'affichage des tuiles Jellyfin dans l'appli sans fuite de clé API, avec Skeleton Loader et hover effect (zoom).
5. **Dataviz Recharts Complexe** : Répartition des plateformes, Activité par Heure, Top Genres sans sacrifier la lisibilité (Composants abstraits).
6. **Interface Shadcn "Premium Dark"** : Sidebar latérale fixe, layout Flex et cartes Dashboards en `bg-zinc-900/50` translucide (Glassmorphism). Affiches avec Hover-zoom et Typography Next.js Inter.
7. **Notifications Discord** : Webhook généré dynamiquement lors d'un `PlaybackStart` avec Embeds enrichis et modulable via les Paramètres.
8. **Sécurité Globale (NextAuth)** : Les pages locales sont verrouillées par un Middleware filtrant et un mot de passe Admin depuis le backend.
9. **Build Standalone** : Fortement optimisé avec variables environnementales fictives (`DATABASE_URL`, `NEXTAUTH_SECRET`) lors de l'étape de compilation Docker pour contourner le prerendering Next.js. De plus, `export const dynamic = "force-dynamic"` garantit que le build est instantané et ne tente aucune connexion BDD Prisma inopportune en phase CI/CD.
