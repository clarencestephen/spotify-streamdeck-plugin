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

- **Elgato Stream Deck** software **v6.9 or newer** — [download here](https://www.elgato.com/downloads)
- **Spotify Premium** account — required by Spotify's Developer API (as of Feb 2026, free accounts can no longer use the API)
- **Node.js v20+** — the Stream Deck SDK bundles this, but if you need it locally: [download here](https://nodejs.org/) or use [nvm-windows](https://github.com/coreybutler/nvm-windows)
- **Git** — [download here](https://git-scm.com/downloads) if you don't have it

---

## Setup (Step by Step)

### Step 1: Create a Spotify Developer App

You need your own Spotify API credentials. This is free and takes 2 minutes.

1. Go to **https://developer.spotify.com/dashboard**
2. Log in with your Spotify account
3. Click **"Create App"**
4. Fill in the form:
   - **App name:** anything you want (e.g. `My Stream Deck Controller`)
   - **App description:** anything (e.g. `Stream Deck plugin`)
   - **Redirect URI:** type exactly `http://127.0.0.1:4202` and click **Add**
   - **Which API/SDKs are you planning to use?** check **Web API**
5. Click **Save**
6. On your new app's page, you'll see your **Client ID** displayed
7. Click **"Show Client Secret"** to reveal your **Client Secret**
8. **Copy both values** — you'll need them in Step 3

> **Keep these private!** Don't share your Client ID or Client Secret publicly. They are unique to your Spotify account.

### Step 2: Install the Plugin

Open a terminal and clone this repo directly into your Stream Deck plugins folder:

**Windows (Command Prompt or PowerShell):**
```bash
git clone https://github.com/clarencestephen/spotify-streamdeck-plugin.git "%APPDATA%\Elgato\StreamDeck\Plugins\com.cognosis.spotify-controller.sdPlugin"
```

**macOS (Terminal):**
```bash
git clone https://github.com/clarencestephen/spotify-streamdeck-plugin.git ~/Library/Application\ Support/com.elgato.StreamDeck/Plugins/com.cognosis.spotify-controller.sdPlugin
```

Then install dependencies:
```bash
cd "%APPDATA%\Elgato\StreamDeck\Plugins\com.cognosis.spotify-controller.sdPlugin"
npm install
```

> **Alternatively**, clone it wherever you want and create a symlink into the plugins folder.

### Step 3: Add Your Spotify Credentials

This is the most important step. The plugin needs your Client ID and Client Secret to talk to Spotify.

1. In the plugin folder, find the file called **`.env.example`**
2. **Copy it** and rename the copy to **`.env`** (just `.env`, no other extension)

   **Windows:**
   ```bash
   copy .env.example .env
   ```
   **macOS/Linux:**
   ```bash
   cp .env.example .env
   ```

3. **Open `.env`** in any text editor (Notepad, VS Code, etc.)
4. Replace the placeholder values with the Client ID and Client Secret you copied from Step 1:

   ```
   SPOTIFY_CLIENT_ID=paste_your_client_id_here
   SPOTIFY_CLIENT_SECRET=paste_your_client_secret_here
   ```

   For example, it should look something like:
   ```
   SPOTIFY_CLIENT_ID=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
   SPOTIFY_CLIENT_SECRET=f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3
   ```

5. **(Optional) Set up the "Like + Add" combo button.** If you want to use the combo button that likes a song AND adds it to a playlist in one press, you also need to add your playlist ID:

   **How to find your playlist ID:**
   1. Open Spotify (desktop app or web)
   2. Right-click the playlist you want to use
   3. Click **Share** > **Copy link to playlist**
   4. You'll get a URL like: `https://open.spotify.com/playlist/0HGqu9QX72YoNhhVlj8TQH`
   5. The part after `/playlist/` is your playlist ID — in this example: `0HGqu9QX72YoNhhVlj8TQH`

   Add these two lines to your `.env` file:
   ```
   SPOTIFY_PLAYLIST_ID=0HGqu9QX72YoNhhVlj8TQH
   SPOTIFY_PLAYLIST_NAME=My Favs
   ```
   Replace the ID with your own, and the name with whatever you want the button to display.

6. **Save the file**

> **Your `.env` file is git-ignored** — it will never be uploaded or shared, even if you push changes. Your secrets stay on your machine only.

> **If you skip this step**, the plugin will show an error in the logs saying "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET". Go back and create the `.env` file.

### Step 4: Build the Plugin

```bash
npm run build
```

You should see output ending with `created bin/plugin.js`. If you see errors, make sure `npm install` completed successfully first.

### Step 5: Restart Stream Deck

Either:
- Restart the Stream Deck software entirely, **or**
- Run this command:
  ```bash
  streamdeck restart com.cognosis.spotify-controller
  ```

The plugin should now appear under the **"Spotify Controller"** category in Stream Deck.

### Step 6: Authorize Your Spotify Account

1. In the Stream Deck app, find **"Spotify Controller"** in the actions list on the right
2. Drag the **"Authorize Spotify"** button onto your Stream Deck
3. **Press the button** on your Stream Deck (or click it in the app)
4. A browser window will open asking you to log in to Spotify and grant permissions
5. Click **"Agree"** — the browser will say "Connected!" and you can close the tab
6. The button on your Stream Deck will change to say **"Connected"**

You only need to do this once. Tokens refresh automatically.

---

## Usage

### Like / Unlike
- Drag **"Like / Unlike Track"** onto your deck
- Press while a song is playing to toggle the like
- The icon auto-syncs with your current track every 10 seconds

### Add to Playlist
- Drag **"Add to Playlist"** onto your deck
- In the Stream Deck editor, click the button to open the **Property Inspector** (settings panel on the right)
- Select your target playlist from the dropdown
- Press the button while a song is playing to add it to that playlist

### Like + Add to Playlist (Combo)
- Drag **"Like + Add to Playlist"** onto your deck
- One press: likes the track AND adds it to a playlist in parallel
- Shows "Done!" on success with the track name

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Button says **"Auth First!"** | You haven't authorized yet. Drag the "Authorize Spotify" button onto your deck and press it |
| Button says **"No Track"** | Spotify isn't playing anything. Start a song first, then press the button |
| Button says **"Set Playlist"** | You need to select a playlist. Click the button in the Stream Deck editor and pick a playlist in the settings panel |
| Button says **"Error"** | Check the logs folder for details. Usually means a network or API issue — try again in a few seconds |
| Playlists not loading in settings | Click "Refresh Playlists" in the settings panel. Make sure you've authorized first |
| Plugin not showing in Stream Deck | Run `streamdeck restart com.cognosis.spotify-controller` or restart the Stream Deck app |
| **"Missing SPOTIFY_CLIENT_ID"** in logs | You didn't create the `.env` file. Go back to [Step 3](#step-3-add-your-spotify-credentials) |
| Auth flow opens but fails | Make sure your Spotify app's Redirect URI is exactly `http://127.0.0.1:4202` (no trailing slash) |
| **"Token refresh failed"** | Your auth expired. Press the Authorize button again to reconnect |
| Rate limited / 429 errors | Spotify is throttling you. The plugin retries automatically — just wait a few seconds |

---

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
├── .env.example               # Template for credentials (safe to share)
├── .env                       # YOUR credentials (git-ignored, you create this)
├── package.json
├── tsconfig.json
└── rollup.config.mjs
```

### Token Storage

OAuth tokens are stored locally at:
- **Windows:** `%APPDATA%\.spotify-streamdeck-tokens.json`
- **macOS:** `~/.spotify-streamdeck-tokens.json`

Tokens auto-refresh in the background. If something goes wrong, press the Authorize button again to re-authenticate.

### Spotify API Compatibility

Updated for the **February 2026** Spotify Web API changes:
- Uses unified `PUT/DELETE /me/library` endpoints with URIs (replaces old per-type endpoints)
- Uses `GET /me/library/contains` with Spotify URIs
- Uses `POST /playlists/{id}/items` (not deprecated `/tracks`)
- Handles rate limiting with exponential backoff and retry

## License

MIT

---

Built by [Cognosis LLC](https://github.com/cognosis)
