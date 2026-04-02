# JellyTrack multi-server migration guide

This document complements the code changes in the JellyTrack Next.js repository.
It covers the plugin-side C# contract updates and deployment steps.

## 1) Prisma migration command sequence

From the JellyTrack root:

1. Ensure schema is up to date:
   npx prisma validate

2. Generate client:
   npx prisma generate

3. Apply migration (dev):
   npx prisma migrate dev --name add_multi_server_support

4. Apply migration (prod):
   npx prisma migrate deploy

If you need a direct SQL migration script, use:
prisma/migrations/20260401120000_add_multi_server_support/migration.sql

## 2) JellyTrack.Plugin event contract (C#)

Add server fields to all emitted event DTOs.

Example for PlaybackStartEvent:

namespace JellyTrack.Plugin.Models;

public sealed class PlaybackStartEvent
{
    public string Event { get; set; } = "PlaybackStart";

    // New multi-server fields
    public string ServerId { get; set; } = string.Empty;
    public string ServerName { get; set; } = string.Empty;
    public string? ServerUrl { get; set; }

    public PluginUser User { get; set; } = new();
    public PluginMedia Media { get; set; } = new();
    public PluginSession Session { get; set; } = new();
}

Apply the same fields to:

- PlaybackProgressEvent
- PlaybackStopEvent
- HeartbeatEvent
- LibraryChangedEvent

## 3) Resolve Jellyfin server identity dynamically in .NET 8

Use Jellyfin server manager and app host services to build a stable server identity.

    using System;
    using Jellyfin.Server.Implementations;
    using MediaBrowser.Controller;
    using MediaBrowser.Model.System;

    namespace JellyTrack.Plugin.Infrastructure;

    public interface IServerIdentityProvider
    {
        string GetServerId();
        string GetServerName();
        string? GetServerUrl();
    }

    public sealed class ServerIdentityProvider : IServerIdentityProvider
    {
        private readonly IServerApplicationHost _appHost;
        private readonly IServerManager _serverManager;

        public ServerIdentityProvider(IServerApplicationHost appHost, IServerManager serverManager)
        {
            _appHost = appHost;
            _serverManager = serverManager;
        }

        public string GetServerId()
        {
            // Prefer Jellyfin internal server GUID/ID as stable multi-node key
            var info = _serverManager.GetServerConfiguration();
            if (!string.IsNullOrWhiteSpace(info?.Id))
            {
                return info.Id;
            }

            // Fallback to startup id if needed
            return _appHost.SystemId ?? "unknown-server";
        }

        public string GetServerName()
        {
            var serverInfo = _appHost.GetSystemInfo();
            return !string.IsNullOrWhiteSpace(serverInfo?.ServerName)
                ? serverInfo.ServerName
                : "Jellyfin";
        }

        public string? GetServerUrl()
        {
            // Optional: expose configured public URL if available
            var systemInfo = _appHost.GetSystemInfo();
            return systemInfo?.WanAddress;
        }
    }

## 4) Inject server identity in outbound webhook payload

    using System.Net.Http;
    using System.Text;
    using System.Text.Json;
    using JellyTrack.Plugin.Infrastructure;
    using JellyTrack.Plugin.Models;

    namespace JellyTrack.Plugin.Services;

    public sealed class EventDispatcher
    {
        private readonly HttpClient _httpClient;
        private readonly IServerIdentityProvider _serverIdentity;

        public EventDispatcher(HttpClient httpClient, IServerIdentityProvider serverIdentity)
        {
            _httpClient = httpClient;
            _serverIdentity = serverIdentity;
        }

        public async Task SendPlaybackStartAsync(PlaybackStartEvent evt, Uri endpoint, string apiKey, CancellationToken ct)
        {
            evt.ServerId = _serverIdentity.GetServerId();
            evt.ServerName = _serverIdentity.GetServerName();
            evt.ServerUrl = _serverIdentity.GetServerUrl();

            var json = JsonSerializer.Serialize(evt);
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };

            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

            using var response = await _httpClient.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();
        }
    }

## 5) Backward compatibility recommendation

For one rollout phase, keep emitting both naming styles in JSON:

- serverId and ServerId
- serverName and ServerName

This lets old/new parsers coexist during plugin and server staggered upgrades.

## 6) Event schema version contract (Phase 3)

All plugin events should carry an explicit schema version:

- field: eventSchemaVersion
- current version: 2

Server ingest compatibility policy:

- server accepts only the current version
- required version is 2
- missing eventSchemaVersion is rejected with HTTP 400
- non-numeric or out-of-range values are rejected with HTTP 400

Compatibility matrix:

| Plugin payload | eventSchemaVersion | Server result |
| --- | --- | --- |
| Legacy plugin | missing | rejected (400) |
| Updated plugin | 2 | accepted |
| Too old/new plugin | <2 or >2 | rejected (400) |
| Invalid field | non-integer | rejected (400) |

Example v2 payload header:

    {
        "event": "PlaybackProgress",
        "eventSchemaVersion": 2,
        "serverId": "...",
        "serverName": "..."
    }
