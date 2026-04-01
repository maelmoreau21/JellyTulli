---
description: "Instructions et mémoire pour agents IA — chargez pour travailler sur le projet JellyTrack"
paths:
  . - "src/**/*.ts"
---

CREATE TABLE users (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	jellyfin_user_id text NOT NULL UNIQUE,
	username text NOT NULL,
	is_active boolean NOT NULL DEFAULT true,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table `media`
CREATE TABLE media (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	jellyfin_media_id text NOT NULL UNIQUE,
	title text NOT NULL,
	type text NOT NULL,
	collection_type text NULL,
	library_name text NULL,
	genres text[] NOT NULL DEFAULT '{}',
	resolution text NULL,
	duration_ms bigint NULL,
	size bigint NULL,
	directors text[] NOT NULL DEFAULT '{}',
	actors text[] NOT NULL DEFAULT '{}',
	studios text[] NOT NULL DEFAULT '{}',
	parent_id text NULL,
	artist text NULL,
	date_added timestamptz NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_media_type ON media(type);
CREATE INDEX idx_media_collection_type ON media(collection_type);

-- Table `playback_history`
CREATE TABLE playback_history (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NULL REFERENCES users(id) ON DELETE CASCADE,
	media_id uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
	play_method text NOT NULL,
	client_name text NULL,
	device_name text NULL,
	ip_address text NULL,
	country text NULL,
	city text NULL,
	duration_watched integer NOT NULL DEFAULT 0,
	started_at timestamptz NOT NULL DEFAULT now(),
	ended_at timestamptz NULL,
	audio_language text NULL,
	audio_codec text NULL,
	subtitle_language text NULL,
	subtitle_codec text NULL,
	pause_count integer NOT NULL DEFAULT 0,
	audio_changes integer NOT NULL DEFAULT 0,
	subtitle_changes integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_playback_user ON playback_history(user_id);
CREATE INDEX idx_playback_media ON playback_history(media_id);
CREATE INDEX idx_playback_started_at ON playback_history(started_at);
CREATE INDEX idx_playback_user_started ON playback_history(user_id, started_at);
CREATE INDEX idx_playback_media_started ON playback_history(media_id, started_at);

-- Table `telemetry_event`
CREATE TABLE telemetry_event (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	playback_id uuid NOT NULL REFERENCES playback_history(id) ON DELETE CASCADE,
	event_type text NOT NULL,
	position_ms bigint NOT NULL,
	metadata jsonb NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_telemetry_playback ON telemetry_event(playback_id);
CREATE INDEX idx_telemetry_event_type ON telemetry_event(event_type);
CREATE INDEX idx_telemetry_playback_event ON telemetry_event(playback_id, event_type);

-- Table `active_stream`
CREATE TABLE active_stream (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	session_id text NOT NULL UNIQUE,
	user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	media_id uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
	play_method text NOT NULL,
	client_name text NULL,
	device_name text NULL,
	ip_address text NULL,
	country text NULL,
	city text NULL,
	video_codec text NULL,
	audio_codec text NULL,
	transcode_fps real NULL,
	bitrate integer NULL,
	audio_language text NULL,
	subtitle_language text NULL,
	subtitle_codec text NULL,
	position_ticks bigint NULL,
	started_at timestamptz NOT NULL DEFAULT now(),
	last_ping_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_active_last_ping ON active_stream(last_ping_at);

-- Table `global_settings` (singleton)
CREATE TABLE global_settings (
	id text PRIMARY KEY DEFAULT 'global',
	discord_webhook_url text NULL,
	discord_alert_condition text NOT NULL DEFAULT 'ALL',
	discord_alerts_enabled boolean NOT NULL DEFAULT false,
	max_concurrent_transcodes integer NOT NULL DEFAULT 0,
	excluded_libraries text[] NOT NULL DEFAULT '{}',
	sync_cron_hour integer NOT NULL DEFAULT 3,
	sync_cron_minute integer NOT NULL DEFAULT 0,
	backup_cron_hour integer NOT NULL DEFAULT 3,
	backup_cron_minute integer NOT NULL DEFAULT 30,
	default_locale text NOT NULL DEFAULT 'fr',
	time_format text NOT NULL DEFAULT '24h',
	wrapped_visible boolean NOT NULL DEFAULT true,
	wrapped_period_enabled boolean NOT NULL DEFAULT true,
	wrapped_start_month integer NOT NULL DEFAULT 12,
	wrapped_start_day integer NOT NULL DEFAULT 1,
	wrapped_end_month integer NOT NULL DEFAULT 1,
	wrapped_end_day integer NOT NULL DEFAULT 31,
	plugin_api_key text NULL,
	plugin_last_seen timestamptz NULL,
	plugin_version text NULL,
	plugin_server_name text NULL,
	updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table `system_health_state` / `system_health_event`
CREATE TABLE system_health_state (
	id text PRIMARY KEY DEFAULT 'global',
	monitor jsonb NOT NULL,
	sync jsonb NOT NULL,
	backup jsonb NOT NULL,
	updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE system_health_event (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	state_id text NOT NULL REFERENCES system_health_state(id) ON DELETE CASCADE,
	source text NOT NULL,
	kind text NOT NULL,
	message text NOT NULL,
	details jsonb NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_health_created_at ON system_health_event(created_at);
CREATE INDEX idx_health_source_created ON system_health_event(source, created_at);

### Remarques MLD
- Les relations 1→N : `media.playback_history`, `user.playback_history`, `playback_history.telemetry_event`.
- Choix de types : `position_ms` et `position_ticks` doivent rester `bigint` pour conserver précision des ticks.
- Pour les IDs UUID : choisir `uuid_generate_v4()` (extension `uuid-ossp`) ou `gen_random_uuid()` (extension `pgcrypto`).
- Conservation et purge : prévoir une purge/archivage de `telemetry_event` > X mois si taille DB élevée.

## 13. Détails Serveur & pipeline d'ingestion (résumé opérationnel)

Ces notes décrivent le flux serveur principal et les points à connaître pour debugging et évolution.

*** End Patch