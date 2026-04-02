# Roadmap 10 propositions securite et produit

Date: 2026-04-02

Contexte: prioriser les evolutions a fort impact pour JellyTrack (app Next.js) et JellyTrack.Plugin (.NET).

## Resume priorise

| Priorite | Proposition | Impact | Effort |
| --- | --- | --- | --- |
| 1 | Rotation automatique des cles plugin | Tres eleve | Moyen |
| 2 | Dashboard securite admin | Eleve | Moyen |
| 3 | Journal d audit admin | Eleve | Moyen |
| 4 | Filtre serveur global persistant | Eleve | Petit a moyen |
| 5 | Comparateur multi serveurs | Moyen | Moyen |
| 6 | Alertes intelligentes et anti bruit | Eleve | Moyen a eleve |
| 7 | Mode maintenance plugin avec buffer | Eleve | Eleve |
| 8 | Verification d integrite backup | Eleve | Moyen |
| 9 | Contrat d evenements versionne | Eleve | Moyen |
| 10 | Centre de sante plugin | Eleve | Moyen |

---

## 1) Rotation automatique des cles plugin

Objectif: reduire la fenetre d exposition d une cle compromise.

Valeur: securite forte, conforme aux bonnes pratiques de gestion de secrets.

Implementation proposee: ajouter des metadonnees de cle dans GlobalSettings (pluginKeyCreatedAt, pluginKeyExpiresAt, pluginKeyRotationDays), ajouter un endpoint admin pour rotation manuelle, ajouter un job de rotation automatique et un mode de transition old/new pour eviter une coupure plugin.

Livrables attendus: rotation manuelle et automatique, alerte avant expiration, ecran admin de configuration.

Effort estime: moyen.

## 2) Dashboard securite admin

Objectif: donner une vue temps reel des risques et anomalies.

Valeur: detection rapide des abus et incidents.

Implementation proposee: nouveau panneau securite dans settings/admin avec volume events plugin par minute, erreurs 401/429 par endpoint, top IP sources, tentatives login bloquees; alimentation via logs structures et metriques de rate limiting.

Livrables attendus: widgets KPI securite, courbes 24h/7j, filtres serveur et endpoint.

Effort estime: moyen.

## 3) Journal d audit admin

Objectif: tracer toutes les actions sensibles pour forensic et conformite.

Valeur: traçabilite complete des actions admin.

Implementation proposee: table audit log dediee (action, actor, cible, diff, ip, user-agent, date), journalisation des changements sensibles (cles plugin, settings critiques, backup import, cleanup), recherche et export CSV.

Livrables attendus: API audit log, UI recherche avec filtres, export CSV.

Effort estime: moyen.

## 4) Filtre serveur global persistant

Objectif: garder le meme scope serveur sur toutes les pages.

Valeur: UX coherente et analyses plus rapides en mode multi serveur.

Implementation proposee: persister la selection serveur dans URL, local storage et cookie serveur; brancher le filtre global sur dashboard, media, logs, recent et analyses; ajouter reset scope global.

Livrables attendus: composant unifie et persistence inter pages.

Effort estime: petit a moyen.

## 5) Comparateur multi serveurs

Objectif: comparer clairement les performances entre instances Jellyfin.

Valeur: aide a la capacite, diagnostics et arbitrage infra.

Implementation proposee: page compare avec colonnes par serveur (streams actifs, transcodes, bitrate moyen, erreurs plugin, latence heartbeat), graphiques empiles et ecarts relatifs.

Livrables attendus: tableau comparatif, graphiques, classement et tendances.

Effort estime: moyen.

## 6) Alertes intelligentes et anti bruit

Objectif: detecter les vrais incidents sans spam.

Valeur: alerting utile, fatigue alerte reduite.

Implementation proposee: regles de seuil statique et baseline, debounce/cooldown/regroupement d alertes similaires, escalade par severite et canal (Discord, webhook).

Livrables attendus: moteur de regles, UI de configuration, historique des alertes.

Effort estime: moyen a eleve.

## 7) Mode maintenance plugin avec buffer

Objectif: eviter la perte de donnees pendant maintenance ou incident reseau.

Valeur: fiabilite ingestion et resilience plugin.

Implementation proposee: mode maintenance cote app (pause traitement avec buffering), queue plugin plus robuste avec retry progressif et purge controllee, replay idempotent a la reprise.

Livrables attendus: toggle maintenance, replay buffer securise, monitoring backlog.

Effort estime: eleve.

## 8) Verification d integrite backup

Objectif: garantir qu un backup est restorable et non corrompu.

Valeur: reduction du risque de perte de donnees en incident.

Implementation proposee: hash SHA-256 + manifest, verification automatique a la creation et avant restore, mode dry-run de restore sans ecriture finale.

Livrables attendus: endpoint verify backup, rapport de validite, hash et manifest stockes.

Effort estime: moyen.

## 9) Contrat d evenements versionne

Objectif: stabiliser la compatibilite entre plugin et serveur.

Valeur: mises a jour sans casse de payload.

Implementation proposee: eventSchemaVersion dans tous les events plugin, parser serveur version-aware avec backward compatibility N-1, documentation contrat et matrice de compatibilite.

Livrables attendus: versioning payload, validation schema par version, matrice de compatibilite.

Effort estime: moyen.

## 10) Centre de sante plugin

Objectif: offrir un diagnostic plugin centralise et actionnable.

Valeur: debug plus rapide et support simplifie.

Implementation proposee: panneau health (heartbeat jitter, taux succes/echec envoi, retries, queue depth, dernier code HTTP, latence p50/p95) et actions admin (test connexion, heartbeat force, export diagnostic).

Livrables attendus: UI health plugin, endpoint stats, export diagnostic JSON.

Effort estime: moyen.

---

## Plan d execution recommande

Phase 1: Rotation cle, Dashboard securite, Journal audit.

Phase 2: Filtre global, Comparateur multi serveurs, Centre de sante plugin.

Phase 3: Alertes intelligentes, Mode maintenance plugin, Integrite backup, Contrat versionne.

## Definition of done commune

Build app et plugin verts, tests mis a jour et passants, documentation mise a jour, aucune regression ingestion plugin, controles securite valides (auth, rate limit, validation input).
