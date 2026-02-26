# JellyTulli - Project Context

## Objectif
Développer "JellyTulli", une solution de monitoring et d'analytique avancée pour Jellyfin, conçue pour supporter une forte charge. Elle se veut supérieure à Jellystat (historique profond, analyse avancée du transcodage, géolocalisation IP, alertes).

## Architecture & Stack Technique
- **Infrastructure** : Docker Compose (App, PostgreSQL, Redis)
- **Base de données** : PostgreSQL (stockage persistant des métriques et historique) via Prisma ORM
- **Cache & Temps Réel** : Redis (pour le stockage des flux en cours, des requêtes très fréquentes et la communication temps réel)
- **Backend / API** : Node.js (via Next.js Server Actions / API Routes), Prisma
- **Frontend** : Next.js (React), Tailwind CSS, Shadcn/UI pour les graphiques avancés et l'interface

## Fonctionnalités Principales Attendues
1. **Monitoring en Temps Réel** :
   - Écoute des Webhooks Jellyfin
   - Analyse du transcodage (codec vidéo/audio, fps de transcodage, bitrate)
   - Suivi rapide via Redis pour soulager la base PostgreSQL
2. **Statistiques Poussées** :
   - Graphiques de temps de lecture (via Recharts)
   - Top utilisateurs et heatmaps d'heures de visionnage
   - Statistiques globales (médias les plus lus, temps de lecture total)
3. **Géolocalisation & Identification Clients** :
   - Tracking des IP via GeoIP (pays, ville)
   - Identification précise de l'appareil et du navigateur
4. **Synchronisation Multi-tâches** :
   - Job asynchrone pour synchroniser les bibliothèques et utilisateurs depuis Jellyfin sans bloquer les performances de l'API.

## Règles Absolues
- **Ce fichier (project_context.md) DOIT être lu avant toute action.**
- Ce fichier doit être mis à jour à chaque modification majeure de l'architecture, de la BDD ou des fonctionnalités pour éviter les hallucinations et garder une base documentaire fiable.

## Structure du Projet (Actualisée)
```
/
├── docker-compose.yml        # Définition de l'infrastructure Docker
├── prisma/
│   └── schema.prisma         # Modèle de base de données PostgreSQL
├── src/
│   ├── app/                  # Routes et pages Next.js
│   │   ├── api/
│   │   │   └── webhook/      # Route API webhook (réception des événements Jellyfin)
│   │   ├── fonts/            # Polices web (Geist)
│   │   ├── globals.css       # Styles globaux (Tailwind + Variables Shadcn)
│   │   ├── layout.tsx        # Layout racine
│   │   └── page.tsx          # Page principale (Dashboard interactif avec Recharts)
│   ├── components/           # Composants UI (Shadcn/UI, Tailwind)
│   │   └── ui/               # Composants Shadcn générés (Card)
│   ├── lib/                  # Utilitaires
│   │   ├── prisma.ts         # Singleton pour le client Prisma
│   │   ├── redis.ts          # Singleton pour le client ioredis
│   │   └── utils.ts          # Utilitaires Tailwind/Shadcn (cn)
│   └── server/               # Définition des jobs asynchrones, services Jellyfin (à venir)
├── components.json           # Configuration Shadcn UI
├── next.config.ts            # Configuration Next.js
├── package.json              # Dépendances du projet (inclut lucide-react, recharts)
├── project_context.md        # Ce document
├── tailwind.config.ts        # Configuration Tailwind
├── test-webhook.js           # Script de simulation des payloads Jellyfin
└── tsconfig.json             # Configuration TypeScript
```
