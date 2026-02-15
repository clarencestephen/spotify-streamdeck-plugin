# Spotify Controller for Stream Deck

A custom Elgato Stream Deck plugin that lets you **like/unlike tracks**, **add songs to playlists**, and do **both at once** with a single button press.

## Features

| Button | Action |
|--------|--------|
| **Authorize Spotify** | Connect (or disconnect) your Spotify account via OAuth |
| **Like / Unlike** | Toggle the ♥ on whatever's currently playing (heart fills/empties) |
| **Add to Playlist** | Add the current track to a specific playlist you choose |
| **♥ + Add to Playlist** | **Combo button** — likes the track AND adds it to a playlist simultaneously |

## Prerequisites

- **Stream Deck** software v6.9+
- **Node.js** v20+ — install via [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)
- **Stream Deck CLI** — `npm install -g @elgato/cli`
- A **Spotify Developer App** (you already have this set up)

## Installation (Developer Mode)

1. **Clone/copy** this entire folder to a location on your PC.

2. **Install dependencies:**
   ```bash
   cd spotify-streamdeck-plugin
   npm install
   ```

3. **Build the plugin:**
   ```bash
   npm run build
   ```

4. **Link to Stream Deck** (dev mode):
   ```bash
   streamdeck link com.cognosis.spotify-controller.sdPlugin
   ```

5. **Restart Stream Deck** if the plugin doesn't appear immediately.

## Development Mode (Hot Reload)

```bash
npm run watch
```

This watches for changes, rebuilds automatically, and restarts the plugin in Stream Deck.

## Setup & First Use

### 1. Authorize
- Drag the **"Authorize Spotify"** button onto your Stream Deck.
- Press it — your browser will open to Spotify's login page.
- Grant permissions → the browser will show "✅ Connected!" and you can close the tab.
- The button title will change to "Connected".

### 2. Like / Unlike
- Drag **"Like / Unlike Track"** onto your deck.
- Press it while a song is playing → toggles the like status.
- The heart icon fills (red) when liked, empties (gray outline) when unliked.
- The icon auto-syncs every 5 seconds with your current track.

### 3. Add to Playlist
- Drag **"Add to Playlist"** onto your deck.
- Click the button in Stream Deck's editor to open the **Property Inspector**.
- Select your target playlist from the dropdown (fetched from your Spotify account).
- Press the button while a song is playing → adds it to that playlist.

### 4. Like + Add to Playlist (Combo)
- Drag **"Like + Add to Playlist"** onto your deck.
- Same setup as above — pick a playlist in the Property Inspector.
- One press: **likes the track AND adds it to the playlist** in parallel.
- Feedback shows both results ("♥ Liked" + "+ Added").

## Token Storage

OAuth tokens are stored locally at:
- **Windows:** `%APPDATA%\.spotify-streamdeck-tokens.json`
- **macOS:** `~/.spotify-streamdeck-tokens.json`

Tokens auto-refresh in the background. If something goes wrong, press the Authorize button again.

## Spotify App Configuration

Your Spotify Developer App should have:
- **Redirect URI:** `http://127.0.0.1:4202`
- **APIs Used:** Web API
- **Scopes requested:** `user-library-read`, `user-library-modify`, `playlist-read-private`, `playlist-modify-public`, `playlist-modify-private`, `user-read-currently-playing`, `user-read-playback-state`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Button says "Auth First!" | Press the Authorize button to connect your account |
| Button says "No Track" | Make sure Spotify is actively playing a song |
| Button says "Set Playlist" | Open the Property Inspector and select a playlist |
| Playlists not loading in PI | Click "🔄 Refresh Playlists" — make sure you're authorized first |
| Plugin not showing in Stream Deck | Run `streamdeck restart com.cognosis.spotify-controller` |

## Project Structure

```
spotify-streamdeck-plugin/
├── com.cognosis.spotify-controller.sdPlugin/   ← The actual plugin
│   ├── bin/                                     ← Compiled JS (auto-generated)
│   ├── imgs/                                    ← Button icons (PNG 72x72 + @2x)
│   ├── ui/
│   │   └── playlist-pi.html                     ← Playlist picker UI
│   ├── logs/
│   └── manifest.json                            ← Plugin metadata
├── src/                                          ← TypeScript source
│   ├── plugin.ts                                 ← Entry point
│   ├── spotify-auth.ts                           ← OAuth 2.0 flow
│   ├── spotify-api.ts                            ← Spotify API wrapper
│   └── actions/
│       ├── authorize.ts                          ← Connect/disconnect
│       ├── like-track.ts                         ← Like/unlike toggle
│       ├── add-to-playlist.ts                    ← Add to playlist
│       ├── like-and-add.ts                       ← Combo button
│       └── playlist-pi-handler.ts                ← Shared PI communication
├── package.json
├── tsconfig.json
├── rollup.config.mjs
└── README.md
```

## Security Note

Your Spotify Client ID is embedded in the source code (this is normal for OAuth desktop apps). The Client Secret is also included since this runs locally on your machine. If you ever share this plugin publicly, rotate your Client Secret in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

---

Built by Cognosis LLC
