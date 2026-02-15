import http from "node:http";
import { URL, fileURLToPath } from "node:url";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import streamDeck from "@elgato/streamdeck";

const logger = streamDeck.logger.createScope("SpotifyAuth");

// Load credentials from .env file in plugin root directory
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  // Resolve the directory of this file (bin/) then look for .env in plugin root
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const envPaths = [
    path.join(thisDir, "..", ".env"),  // plugin root (bin/../.env)
    path.join(thisDir, ".env"),        // same dir as binary
    path.join(process.cwd(), ".env"),  // working directory fallback
  ];
  for (const envPath of envPaths) {
    try {
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, "utf-8").split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
          }
        }
        logger.info(`Loaded .env from ${envPath}`);
        return env;
      }
    } catch { /* try next path */ }
  }
  logger.warn("No .env file found — SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set");
  return env;
}

const dotenv = loadEnv();
const CLIENT_ID = dotenv.SPOTIFY_CLIENT_ID ?? process.env.SPOTIFY_CLIENT_ID ?? "";
const CLIENT_SECRET = dotenv.SPOTIFY_CLIENT_SECRET ?? process.env.SPOTIFY_CLIENT_SECRET ?? "";
const REDIRECT_URI = "http://127.0.0.1:4202";

if (!CLIENT_ID || !CLIENT_SECRET) {
  logger.error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET. Create a .env file — see .env.example");
}

/** Read a value from .env (loaded at startup) or process.env */
export function getEnv(key: string): string {
  return dotenv[key] ?? process.env[key] ?? "";
}
const SCOPES = [
  "user-library-read",
  "user-library-modify",
  "user-follow-read",
  "user-follow-modify",
  "playlist-read-private",
  "playlist-modify-public",
  "playlist-modify-private",
  "user-read-currently-playing",
  "user-read-playback-state",
].join(" ");

const TOKEN_FILE = path.join(
  process.env.APPDATA || process.env.HOME || ".",
  ".spotify-streamdeck-tokens.json"
);

type SpotifyTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

type AuthCallback = () => void;

class SpotifyAuth {
  private tokens: SpotifyTokens | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private onAuthCallbacks: AuthCallback[] = [];

  constructor() {
    this.loadTokens();
    logger.info(`Initialized. Authorized: ${this.isAuthorized}, token file: ${TOKEN_FILE}`);
  }

  get isAuthorized(): boolean {
    return this.tokens !== null && !!this.tokens.refresh_token;
  }

  onAuthorized(cb: AuthCallback): void {
    this.onAuthCallbacks.push(cb);
  }

  async getAccessToken(): Promise<string> {
    if (!this.tokens) throw new Error("Not authorized");
    const expiresIn = Math.floor((this.tokens.expires_at - Date.now()) / 1000);
    logger.debug(`Token expires in ${expiresIn}s`);
    if (Date.now() >= this.tokens.expires_at - 60_000) {
      logger.info("Token expired or expiring soon, refreshing...");
      await this.refreshAccessToken();
    }
    return this.tokens.access_token;
  }

  async authorize(): Promise<void> {
    const state = crypto.randomBytes(16).toString("hex");

    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url!, `http://127.0.0.1:4202`);
          if (url.pathname !== "/") { res.writeHead(404); res.end(); return; }

          const code = url.searchParams.get("code");
          const returnedState = url.searchParams.get("state");
          const error = url.searchParams.get("error");

          if (error) {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(htmlPage("Denied", "You denied the request. Close this tab."));
            server.close(); reject(new Error(`Auth error: ${error}`)); return;
          }
          if (!code || returnedState !== state) {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(htmlPage("Error", "Invalid response. Try again."));
            server.close(); reject(new Error("Invalid callback.")); return;
          }

          await this.exchangeCode(code);
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(htmlPage("✅ Connected!", "Spotify is linked to Stream Deck. Close this tab."));
          server.close();
          this.onAuthCallbacks.forEach((cb) => cb());
          resolve();
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end(htmlPage("Error", "Something went wrong."));
          server.close(); reject(err);
        }
      });

      server.listen(4202, "127.0.0.1", () => {
        const authUrl = new URL("https://accounts.spotify.com/authorize");
        authUrl.searchParams.set("client_id", CLIENT_ID);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
        authUrl.searchParams.set("scope", SCOPES);
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("show_dialog", "true");

        const cmd = process.platform === "win32"
          ? `start "" "${authUrl.toString()}"`
          : process.platform === "darwin"
          ? `open "${authUrl.toString()}"`
          : `xdg-open "${authUrl.toString()}"`;
        exec(cmd);
      });

      setTimeout(() => { server.close(); reject(new Error("Auth timed out.")); }, 300_000);
    });
  }

  disconnect(): void {
    this.tokens = null;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    try { fs.unlinkSync(TOKEN_FILE); } catch { /* ok */ }
  }

  private async exchangeCode(code: string): Promise<void> {
    const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI });
    const resp = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      },
      body: body.toString(),
    });
    if (!resp.ok) { const t = await resp.text(); throw new Error(`Token exchange failed: ${t}`); }
    this.setTokens(await resp.json() as Record<string, unknown>);
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.tokens?.refresh_token) throw new Error("No refresh token.");
    const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: this.tokens.refresh_token });
    const resp = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      },
      body: body.toString(),
    });
    if (!resp.ok) {
      if (resp.status === 400 || resp.status === 401) this.disconnect();
      throw new Error(`Token refresh failed: ${resp.status}`);
    }
    this.setTokens(await resp.json() as Record<string, unknown>);
  }

  private setTokens(data: Record<string, unknown>): void {
    this.tokens = {
      access_token: data.access_token as string,
      refresh_token: (data.refresh_token as string) ?? this.tokens?.refresh_token ?? "",
      expires_at: Date.now() + (data.expires_in as number) * 1000,
    };
    this.saveTokens();
    this.scheduleRefresh(data.expires_in as number);
  }

  private scheduleRefresh(expiresInSecs: number): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const ms = Math.max((expiresInSecs - 120) * 1000, 30_000);
    this.refreshTimer = setTimeout(() => {
      this.refreshAccessToken().catch((err) => {
        logger.error(`Scheduled refresh failed: ${err instanceof Error ? err.message : err}`);
      });
    }, ms);
  }

  private saveTokens(): void {
    try { fs.writeFileSync(TOKEN_FILE, JSON.stringify(this.tokens, null, 2), "utf-8"); } catch { /* */ }
  }

  private loadTokens(): void {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        this.tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));
        if (this.tokens && this.tokens.expires_at > Date.now()) {
          const secs = Math.floor((this.tokens.expires_at - Date.now()) / 1000);
          logger.info(`Loaded tokens from file, expires in ${secs}s`);
          this.scheduleRefresh(secs);
        } else {
          logger.warn("Loaded tokens are expired");
        }
      } else {
        logger.info("No token file found");
      }
    } catch (err) {
      logger.error(`Failed to load tokens: ${err}`);
      this.tokens = null;
    }
  }
}

function htmlPage(title: string, msg: string): string {
  return `<!DOCTYPE html><html><head><title>Spotify</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#191414;color:#fff}
h1{color:#1DB954}p{color:#b3b3b3}</style></head>
<body><div style="text-align:center"><h1>${title}</h1><p>${msg}</p></div></body></html>`;
}

export const spotifyAuth = new SpotifyAuth();
