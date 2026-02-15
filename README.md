# Spotify Controller for Stream Deck

An Elgato Stream Deck plugin (SDK v2.0) that lets you control Spotify directly from your Stream Deck. Like tracks, add songs to playlists, or do both with a single button press.

## Features

| Button | Action |
|--------|--------|
| **Authorize Spotify** | Connect (or disconnect) your Spotify account via OAuth |
| **Like / Unlike** | Toggle the like on whatever's currently playing (syncs every 10s) |
| **Add to Playlist** | Add the current track to a specific playlist you choose |
| **Like + Add to Playlist** | **Combo button** — likes the track AND adds it to a playlist simultaneously |

## Requirements

- **Stream Deck** software v6.9+
- **Node.js** v20+ (bundled by Stream Deck SDK)
- **Spotify Premium** account (required by Spotify's Developer API since Feb 2026)
- A **Spotify Developer App** (free to create)

## Setup

### 1. Create a Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Set the **Redirect URI** to `http://127.0.0.1:4202`
4. Note your **Client ID** and **Client Secret**

### 2. Install the Plugin

Clone this repo into your Stream Deck plugins directory:

**Windows:**
```bash
git clone https://github.com/cognosis/spotify-streamdeck-plugin.git "%APPDATA%\Elgato\StreamDeck\Plugins\com.cognosis.spotify-controller.sdPlugin"
```

**macOS:**
```bash
git clone https://github.com/cognosis/spotify-streamdeck-plugin.git ~/Library/Application\ Support/com.elgato.StreamDeck/Plugins/com.cognosis.spotify-controller.sdPlugin
```

Or clone it anywhere and symlink it into the plugins folder.

### 3. Configure Credentials

Copy the example env file and add your Spotify app credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

> **Important:** The `.env` file is git-ignored and will never be committed. Your secrets stay on your machine.

### 4. Build

```bash
npm install
npm run build
```

Then restart the plugin:
```bash
streamdeck restart com.cognosis.spotify-controller
```

### 5. Authorize

Drag the **Authorize Spotify** button onto your Stream Deck and press it. A browser window will open to connect your Spotify account.

## Usage

### Like / Unlike
- Drag **"Like / Unlike Track"** onto your deck.
- Press while a song is playing to toggle the like.
- The icon auto-syncs with your current track every 10 seconds.

### Add to Playlist
- Drag **"Add to Playlist"** onto your deck.
- Open the **Property Inspector** (click the button in Stream Deck's editor) and select your target playlist.
- Press while a song is playing to add it to that playlist.

### Like + Add to Playlist (Combo)
- Drag **"Like + Add to Playlist"** onto your deck.
- One press: likes the track AND adds it to a playlist in parallel.
- Shows "Done!" on success with the track name.

## Development

```bash
npm run watch    # Rebuild on changes + auto-restart plugin
```

### Project Structure

```
├── src/
│   ├── plugin.ts              # Entry point — registers all actions
│   ├── spotify-auth.ts        # OAuth 2.0 flow + token management
│   ├── spotify-api.ts         # Spotify Web API wrapper
│   └── actions/
│       ├── authorize.ts       # Connect/disconnect button
│       ├── like-track.ts      # Like/unlike with polling
│       ├── add-to-playlist.ts # Add to a selected playlist
│       ├── like-and-add.ts    # Combo: like + add in one press
│       └── playlist-pi-handler.ts
├── ui/
│   └── playlist-pi.html       # Property Inspector for playlist selection
├── manifest.json              # Stream Deck plugin manifest (SDK v2)
├── .env.example               # Template for Spotify credentials
├── .env                       # Your credentials (git-ignored, create this)
├── package.json
├── tsconfig.json
└── rollup.config.mjs
```

## Token Storage

OAuth tokens are stored locally at:
- **Windows:** `%APPDATA%\.spotify-streamdeck-tokens.json`
- **macOS:** `~/.spotify-streamdeck-tokens.json`

Tokens auto-refresh in the background. If something goes wrong, press the Authorize button again.

## Spotify API Compatibility

Updated for the **February 2026** Spotify Web API changes:
- Uses unified `PUT/DELETE /me/library` endpoints with URIs (replaces old per-type endpoints)
- Uses `GET /me/library/contains` with Spotify URIs
- Uses `POST /playlists/{id}/items` (not deprecated `/tracks`)
- Handles rate limiting with exponential backoff and retry

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Button says "Auth First!" | Press the Authorize button to connect your account |
| Button says "No Track" | Make sure Spotify is actively playing a song |
| Button says "Set Playlist" | Open the Property Inspector and select a playlist |
| Playlists not loading | Click "Refresh Playlists" in PI — make sure you're authorized first |
| Plugin not appearing | Run `streamdeck restart com.cognosis.spotify-controller` |
| Missing credentials error | Make sure you created `.env` with your Client ID and Secret |

## License

MIT

---

Built by [Cognosis LLC](https://github.com/cognosis)
