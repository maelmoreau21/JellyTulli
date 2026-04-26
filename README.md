
# 🍐 JellyTrack

<p align="center">
  <img src="public/logo.svg" width="128" height="128" alt="JellyTrack Logo">
  <br>
  <strong>Observabilité et analytics pour Jellyfin</strong>
  <br>
  <em>Sessions en direct, historique enrichi, métriques de lecture, backups et intégrations.</em>
</p>

<p align="center">
  <a href="https://github.com/maelmoreau21/JellyTrack/actions/workflows/docker-publish.yml"><img src="https://github.com/maelmoreau21/JellyTrack/actions/workflows/docker-publish.yml/badge.svg" alt="Docker Build"></a>
  <a href="https://ghcr.io/maelmoreau21/JellyTrack"><img src="https://img.shields.io/badge/GHCR-ghcr.io%2Fmaelmoreau21%2FJellyTrack-blue?logo=github" alt="GHCR Image"></a>
</p>

---

## 🚀 Installation Rapide (Docker)

La méthode recommandée pour installer JellyTrack est d'utiliser Docker.

### 1. Prérequis
- Docker et Docker Compose installés.
- Une instance Jellyfin accessible.

### 2. Déploiement
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

Puis lancez la stack :
```bash
docker compose up -d
```

Accédez à l'interface sur `http://localhost:3000` et connectez-vous avec votre `ADMIN_PASSWORD`.

---

## 🔌 Plugin Jellyfin (REQUIS)

Pour que JellyTrack puisse collecter des données, vous **devez** installer le plugin compagnon sur votre serveur Jellyfin.

### [👉 Télécharger le Plugin JellyTrack](https://github.com/maelmoreau21/JellyTrack.Plugin)

#### Installation via Dépôt (Recommandé) :
1. Dans Jellyfin : **Tableau de bord** > **Plugins** > **Dépôts**.
2. Ajoutez un nouveau dépôt :
   - **Nom** : JellyTrack
   - **URL** : `https://raw.githubusercontent.com/maelmoreau21/JellyTrack.Plugin/main/manifest.json`
3. Allez dans **Catalogue**, cherchez **JellyTrack** et installez-le.
4. Redémarrez Jellyfin.

---

## 🌟 Fonctionnalités

- **Dashboard Live** : Visualisez qui regarde quoi en temps réel (Direct Play vs Transcode, débit, etc.).
- **Historique Enrichi** : Historique complet des lectures avec détails techniques (codecs, sous-titres, langues).
- **Statistiques & Tendances** : Tops utilisateurs, médias les plus vus, tendances par jour/heure.
- **Journaux Système & Audit** : Suivi des connexions admin et de la santé de la synchronisation.
- **Sécurité** : Authentification via Jellyfin, hachage des clés API, et support du mode multi-serveur.

## 🛠️ Configuration Avancée

Consultez le fichier [instructions.md](.claude/rules/instructions.md) pour les détails techniques sur l'architecture et les variables d'environnement.

## 📄 Licence
Projet personnel — usage privé.

Built with Next.js, Prisma, Redis & beaucoup de ☕
