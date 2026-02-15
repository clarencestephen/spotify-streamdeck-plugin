# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spotify Controller for Stream Deck — an Elgato Stream Deck plugin (SDK v2.0) that provides Spotify control buttons: Authorize, Like/Unlike Track, Add to Playlist, and a combined Like + Add button. Built with TypeScript targeting Node.js 20.

The primary feature is the **Like + Add to Playlist** combo button (`like-and-add.ts`).

## Build Commands

```bash
npm install                        # Install dependencies
npm run build                      # One-time build with Rollup
npm run watch                      # Watch mode with auto-restart
streamdeck restart com.cognosis.spotify-controller  # Manual restart
```

There are no tests configured.

## Architecture

**Flat structure:** The project root IS the `.sdPlugin` directory — `manifest.json`, `bin/`, `imgs/`, `ui/`, and `logs/` are all at the root alongside source files. The symlink in Stream Deck's Plugins directory points directly here.

**Entry point:** `src/plugin.ts` — registers all four actions with `@elgato/streamdeck`.

**Build pipeline:** Rollup bundles `src/plugin.ts` → `bin/plugin.js` (single ESM bundle). TypeScript targets ES2022.

**Actions** (all extend `SingletonAction` from `@elgato/streamdeck`):
- `src/actions/authorize.ts` — Opens OAuth flow via local HTTP server
- `src/actions/like-track.ts` — Polls Spotify every 5s to sync like state, toggles on press
- `src/actions/add-to-playlist.ts` — Adds current track to a user-selected playlist
- `src/actions/like-and-add.ts` — Combines like + add-to-playlist in parallel
- `src/actions/playlist-pi-handler.ts` — Sends playlist data to the Property Inspector via `streamDeck.ui.sendToPropertyInspector()`

**Core modules:**
- `src/spotify-auth.ts` — OAuth 2.0 with local HTTP server on port 4202, stores tokens at `%APPDATA%\.spotify-streamdeck-tokens.json` (Windows) or `~/.spotify-streamdeck-tokens.json` (macOS). Auto-refreshes tokens before expiry.
- `src/spotify-api.ts` — Thin wrapper around Spotify Web API endpoints with authenticated `apiFetch()`.

**Property Inspector UI:** `ui/playlist-pi.html` — WebSocket-based HTML UI for playlist dropdown selection, communicates with plugin via `sendToPlugin`/`sendToPropertyInspector`.

## Key Patterns

- To send data from plugin to the Property Inspector, use `streamDeck.ui.sendToPropertyInspector()` (NOT `ev.action.sendToPropertyInspector` which doesn't exist, and NOT `setGlobalSettings` which the PI doesn't read)
- `SendToPluginEvent` generic types come from `@elgato/utils` (e.g., `JsonValue`, `JsonObject`), not from `@elgato/streamdeck`
- Actions use polling (not push) for state sync since Spotify has no WebSocket API
- User feedback is shown as temporary button titles that auto-clear after ~2 seconds
- Settings (e.g., selected playlist) persist via Stream Deck's per-action settings system
