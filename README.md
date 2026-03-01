<div align="center">

# 🍐 JellyTulli

**Le dashboard analytique ultime pour Jellyfin**

*Jellyfin + Tautulli = JellyTulli*

[![Docker Build](https://github.com/maelmoreau21/JellyTulli/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/maelmoreau21/JellyTulli/actions/workflows/docker-publish.yml)
[![GHCR Image](https://img.shields.io/badge/GHCR-ghcr.io%2Fmaelmoreau21%2Fjellytulli-blue?logo=github)](https://ghcr.io/maelmoreau21/jellytulli)

</div>

---

## Aperçu

JellyTulli est un wrapper analytique autonome pour **Jellyfin**, inspiré de Tautulli (Plex). Il offre un tableau de bord complet avec statistiques en temps réel, historiques de lecture, alertes Discord, récapitulatifs annuels (Wrapped), et bien plus — le tout optimisé pour tourner sur un **Raspberry Pi**.

### Fonctionnalités principales

| Catégorie | Détail |
|---|---|
| **Dashboard temps réel** | Streams actifs (auto-refresh 10s), bande passante, DirectPlay %, pic de charge |
| **Historique complet** | Logs de toutes les sessions avec Watch Party detection, filtres par type, recherche |
| **Bibliothèque média** | Grille Films / Séries / Musique avec agrégation épisodes→séries, pistes→albums |
| **Profil média** | Page dédiée par média : KPIs, télémétrie (pauses, changements audio/sous-titres), drop-off chart, breadcrumbs hiérarchiques |
| **Profils utilisateurs** | Stats par utilisateur, historique récent, médias favoris |
| **Analyses détaillées** | Top 5 par catégorie, répartition DirectPlay/Transcode, activité horaire, heatmap annuel |
| **Réseau** | Taux de transcodage, profil client, "Table des Coupables" (médias les plus transcodés) |
| **Wrapped** | Récap annuel style Spotify : top médias, genres, séries, artistes, pic d'activité, graphes mensuels |
| **Newsletter** | Rapport mensuel A4 généré automatiquement |
| **Webhooks Jellyfin** | Capture `PlaybackStart` / `PlaybackProgress` / `PlaybackStop` pour alertes Discord et télémétrie |
| **Backups automatiques** | Sauvegarde quotidienne à 3h30, rotation sur 5 fichiers, restauration en un clic |
| **Hardware Monitor** | CPU, RAM, température en direct sur le dashboard |
| **RBAC** | Admins : accès total · Utilisateurs : accès limité à leur Wrapped |

---

## Tech Stack

| Couche | Technologie |
|---|---|
| Framework | **Next.js 15+** (App Router, Server Components, standalone output) |
| Base de données | **PostgreSQL** + **Prisma ORM** |
| Cache temps réel | **Redis** (ioredis) |
| UI | **TailwindCSS** + **shadcn/ui** + **Lucide Icons** |
| DataViz | **Recharts** + **react-activity-calendar** |
| Auth | **NextAuth** (Jellyfin native credentials) |
| CI/CD | **GitHub Actions** → **GHCR** (ARM64) |
| Déploiement | **Docker Compose** (Raspberry Pi ready) |

---

## Installation

### Prérequis

- **Docker** et **Docker Compose** installés
- Compte **Jellyfin** avec un utilisateur administrateur
- (Optionnel) URL de webhook Discord pour les alertes

### 1. Cloner le projet

```bash
git clone https://github.com/maelmoreau21/JellyTulli.git
cd JellyTulli
```

### 2. Configurer les variables d'environnement

Édite le fichier `docker-compose.yml` et personnalise les variables :

```yaml
environment:
  - DATABASE_URL=postgresql://jellytulli:jellytulli_password@postgres:5432/jellytulli?schema=public&connection_limit=5
  - REDIS_URL=redis://redis:6379
  - ADMIN_PASSWORD=ton_mot_de_passe_admin        # ← À changer !
  - NEXTAUTH_SECRET=ta_clé_secrète_aléatoire     # ← À changer ! (openssl rand -base64 32)
  - NEXTAUTH_URL=http://ton-ip:3000              # ← Ton IP locale ou domaine
  - BACKUP_DIR=/data/backups
```

### 3. Lancer la stack

```bash
docker compose up -d
```

L'image ARM64 pré-compilée sera automatiquement téléchargée depuis le GitHub Container Registry. Plus besoin de build sur le Raspberry Pi !

### 4. Premier lancement

Accède à `http://ton-ip:3000` — le **Setup Wizard** te guidera pour connecter ton serveur Jellyfin (URL + clé API).

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                GitHub Actions                    │
│   push main → Build ARM64 → Push GHCR           │
└─────────────────────┬───────────────────────────┘
                      │ docker pull
┌─────────────────────▼───────────────────────────┐
│              Raspberry Pi (Docker)               │
│  ┌───────────────────────────────────────────┐   │
│  │  JellyTulli (Next.js standalone)          │   │
│  │  ├── Dashboard (SSR + Client polling)     │   │
│  │  ├── Webhook receiver (/api/webhook)      │   │
│  │  ├── Session monitor (heartbeat 5s)       │   │
│  │  └── Auto-backup (cron 3h30)              │   │
│  └──────────┬──────────────┬─────────────────┘   │
│             │              │                      │
│  ┌──────────▼──┐  ┌───────▼────────┐            │
│  │  PostgreSQL  │  │     Redis      │            │
│  │  (données)   │  │ (streams live) │            │
│  └─────────────┘  └────────────────┘            │
└─────────────────────────────────────────────────┘
         │
         │ API calls
┌────────▼────────┐
│  Jellyfin Server │
│  (Webhooks +     │
│   Sessions API)  │
└─────────────────┘
```

---

## Configuration Jellyfin

### Webhook (recommandé)

Pour la capture en temps réel des événements de lecture :

1. Installe le plugin **Webhook** dans Jellyfin
2. Ajoute un webhook de type **Generic Destination**
3. URL : `http://ton-ip-jellytulli:3000/api/webhook/jellyfin`
4. Événements : `Playback Start`, `Playback Progress`, `Playback Stop`

### Synchronisation

La synchronisation de la bibliothèque se fait automatiquement via le bouton **Sync** dans les paramètres, ou via l'API `/api/sync`.

---

## Mise à jour

```bash
docker compose pull    # Télécharge la dernière image
docker compose up -d   # Relance avec la nouvelle version
```

Grâce au CI/CD, chaque push sur `main` génère automatiquement une nouvelle image ARM64 sur GHCR.

---

## Développement local

```bash
# Installer les dépendances
npm ci

# Lancer les services (DB + Redis)
docker compose up postgres redis -d

# Variables d'environnement (créer un .env.local)
DATABASE_URL="postgresql://jellytulli:jellytulli_password@localhost:5432/jellytulli?schema=public"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_SECRET="dev-secret"
NEXTAUTH_URL="http://localhost:3000"

# Pousser le schéma Prisma
npx prisma db push

# Lancer le serveur de dev
npm run dev
```

---

## Volumes Docker

| Volume | Contenu |
|---|---|
| `jellytulli_pgdata` | Données PostgreSQL |
| `jellytulli_redisdata` | Données Redis (sessions live) |
| `jellytulli_backups` | Sauvegardes automatiques JSON |

---

## Licence

Projet personnel — usage privé.

---

<div align="center">
  <sub>Built with Next.js, Prisma, Redis & beaucoup de ☕ — Optimisé pour Raspberry Pi</sub>
</div>
