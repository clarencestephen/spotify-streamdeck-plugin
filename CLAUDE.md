# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run build         # Compile the plugin (output: com.cognosis.spotify-playlist-ops.sdPlugin/bin/plugin.js)
npm run watch         # Watch mode with auto-restart of Stream Deck plugin
```

The build uses Rollup with TypeScript. Output is bundled and minified for production.

## Architecture Overview

This is a Stream Deck plugin that controls Spotify playback via the Spotify Web API. Requires Spotify Premium.

### Core Components

**Entry Point** (`src/plugin.js`)
- Initializes HTTP agent with DNS caching and keep-alive
- Connects to Stream Deck via `@elgato/streamdeck` SDK
- Loads OAuth tokens from global settings
- Registers all 27 actions

**Connector** (`src/library/connector.js`) - Singleton
- Manages OAuth flow via Express server on port 6545
- Handles token refresh on 401 responses
- `callSpotifyApi(path, options, allowResponses)` - authenticated API calls
- Emits `setupStateChanged` event
- Note: Has hardcoded proxy agent for debugging (line 16-22)

**Wrapper** (`src/library/wrapper.js`) - Singleton
- Maintains cached playback state (song, volume, shuffle, repeat, devices)
- Polls Spotify every 5 seconds (`INTERVAL_UPDATE_PLAYBACK_STATE`)
- Interpolates song progress locally every 500ms for smooth display
- `#wrapCall(fn, parallel)` - queues API calls, returns response symbols
- Emits events: `songChanged`, `playbackStateChanged`, `volumePercentChanged`, etc.

**Response Symbols** (from `src/library/constants.js`)
- `WRAPPER_RESPONSE_SUCCESS` - Action completed
- `WRAPPER_RESPONSE_BUSY` - Call already in progress
- `WRAPPER_RESPONSE_API_RATE_LIMITED` - 429 error
- `WRAPPER_RESPONSE_NO_DEVICE_ERROR` - No playback device
- `WRAPPER_RESPONSE_NOT_AVAILABLE` - Action restricted

### Action Classes

Base classes in `src/actions/`:
- `Action.ts` - Settings management, image processing
- `Button.ts` - Key press handling, hold detection (500ms delay, 250ms repeat), multi-press (250ms window), marquee scrolling
- `Dial.ts` - Encoder rotation, tap, push handling with layout updates
- `ItemsDial.ts` - Base for playlist/liked songs navigation

19 button implementations and 5 dial implementations handle specific Spotify controls.

### Data Flow

```
Stream Deck Button Press
    → Action class handles KeyDown/KeyUp
    → Calls wrapper method (e.g., wrapper.togglePlayback())
    → Wrapper queues call, returns response symbol
    → Action shows visual feedback based on symbol
    → Wrapper emits state change events
    → All listening actions update their displays
```

### Key Files

| File | Purpose |
|------|---------|
| `src/library/connector.js` | OAuth, token refresh, API gateway |
| `src/library/wrapper.js` | State management, polling, event emission |
| `src/library/constants.js` | Timing values, response symbols, API scopes |
| `com.cognosis.spotify-playlist-ops.sdPlugin/manifest.json` | Plugin definition, action UUIDs |

### Spotify API Scopes

```
user-read-currently-playing, user-read-playback-state, user-modify-playback-state,
user-read-private, user-library-read, user-library-modify,
playlist-read-private, playlist-modify-public, playlist-modify-private
```

## Codebase Notes

- **Hybrid JS/TS**: Library files are JavaScript, action files are TypeScript
- **Proxy debugging**: `src/library/connector.js` line 16 has a hardcoded proxy toggle (`true ? new ProxyAgent...`)
- **Sonos limitation**: Sonos speakers cannot be controlled (Spotify API restriction)
- **Plugin UUID**: `com.cognosis.spotify-playlist-ops`
- **OAuth callback**: `http://127.0.0.1:6545`

## Adding New Actions

1. Create action class in `src/actions/` extending `Button` or `Dial`
2. Register in `src/library/actions.js`
3. Add to `manifest.json` with UUID, icon, states, Property Inspector path
4. Create Property Inspector HTML in `src/ui/pi/` if configurable
