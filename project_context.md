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

## Structure du Projet (Théorique)
```
/
├── docker-compose.yml        # Définition de l'infrastructure Docker
├── prisma/
│   └── schema.prisma         # Modèle de base de données PostgreSQL
├── src/
│   ├── app/                  # Routes et pages Next.js
│   ├── components/           # Composants UI (Shadcn/UI, Tailwind)
│   ├── lib/                  # Utilitaires (Clients Redis, Prisma, GeoIP, Webhooks)
│   └── server/               # Définition des jobs asynchrones, services Jellyfin
├── project_context.md        # Ce document
└── package.json              # Dépendances du projet
```
