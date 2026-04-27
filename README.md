<p align="center">
  <img src="public/logo.svg" width="128" height="128" alt="JellyTrack Logo">
</p>

<h1 align="center">JellyTrack</h1>

<p align="center">
  <a href="https://github.com/maelmoreau21/JellyTrack/actions/workflows/docker-publish.yml"><img src="https://github.com/maelmoreau21/JellyTrack/actions/workflows/docker-publish.yml/badge.svg" alt="Docker Build"></a>
  <a href="https://ghcr.io/maelmoreau21/JellyTrack"><img src="https://img.shields.io/badge/GHCR-ghcr.io%2Fmaelmoreau21%2FJellyTrack-blue?logo=github" alt="GHCR Image"></a>
</p>

<p align="center">
  <strong>Observabilité et analytics pour Jellyfin : sessions en direct, historique enrichi et métriques de lecture.</strong>
</p>

---

> [!CAUTION]
> ### 🚨 LE PLUGIN JELLYFIN EST OBLIGATOIRE
> JellyTrack **ne peut pas** collecter de données sans son plugin compagnon installé sur votre serveur Jellyfin.
> 
> [👉 Cliquez ici pour configurer le plugin](https://github.com/maelmoreau21/JellyTrack.Plugin)

---

## 🚀 Installation (Méthode Recommandée : Docker)

L'utilisation de **Docker Compose** est le moyen le plus simple et recommandé pour déployer JellyTrack.

### 1. Déploiement

Créez un fichier `docker-compose.yml` :

```yaml
services:
  jellytrack:
    image: ghcr.io/maelmoreau21/jellytrack:latest
    container_name: jellytrack
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://jellytrack:CHANGE_ME_DB_PASS@db:5432/jellytrack
      - REDIS_URL=redis://redis:6379
      - JELLYFIN_URL=http://your-jellyfin-ip:8096
      - ADMIN_PASSWORD=CHANGE_ME_ADMIN_PASS
      - NEXTAUTH_SECRET=CHANGE_ME_AUTH_SECRET
      - NEXTAUTH_URL=http://localhost:3000
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    container_name: jellytrack-db
    environment:
      - POSTGRES_USER=jellytrack
      - POSTGRES_PASSWORD=CHANGE_ME_DB_PASS
      - POSTGRES_DB=jellytrack
    volumes:
      - jellytrack-db-data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:alpine
    container_name: jellytrack-redis
    restart: unless-stopped

volumes:
  jellytrack-db-data:
```

### 2. Lancement

```bash
docker compose up -d
```

### 3. Accès

Rendez-vous sur `http://localhost:3000` et connectez-vous avec votre `ADMIN_PASSWORD`.

---

## 🌟 Fonctionnalités

- **Dashboard Live** : Visualisez qui regarde quoi en temps réel (Direct Play vs Transcode, débit, etc.).
- **Historique Enrichi** : Détails techniques complets (codecs, sous-titres, langues).
- **Statistiques & Tendances** : Tops utilisateurs, médias les plus vus, graphiques d'activité.
- **Journaux Système & Audit** : Suivi de la santé de la synchronisation.
- **Sécurité** : Authentification via Jellyfin, hachage des clés API, support multi-serveur.

---

## 🔌 Configuration du Plugin

Une fois le serveur installé, vous devez configurer le plugin sur votre instance Jellyfin pour commencer à recevoir des données.

**Dépôt du Plugin :** [JellyTrack.Plugin](https://github.com/maelmoreau21/JellyTrack.Plugin)

1. Dans Jellyfin : **Tableau de bord** > **Plugins** > **Dépôts**.
2. URL du dépôt : `https://raw.githubusercontent.com/maelmoreau21/JellyTrack.Plugin/main/manifest.json`
3. Installez le plugin **JellyTrack** depuis le catalogue.

---

## 📄 Licence

Projet personnel — usage privé.
Built with Next.js, Prisma, Redis & beaucoup de ☕
