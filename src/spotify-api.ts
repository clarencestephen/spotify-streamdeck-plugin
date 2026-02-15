import streamDeck from "@elgato/streamdeck";
import { spotifyAuth } from "./spotify-auth";

const logger = streamDeck.logger.createScope("SpotifyAPI");
const BASE = "https://api.spotify.com/v1";

async function apiFetch(endpoint: string, init?: { method?: string; body?: string }): Promise<Response> {
  const token = await spotifyAuth.getAccessToken();
  const method = init?.method ?? "GET";

  for (let attempt = 0; attempt < 3; attempt++) {
    logger.debug(`${method} ${endpoint}${attempt > 0 ? ` (retry ${attempt})` : ""}`);
    const resp = await fetch(`${BASE}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: init?.body,
    });

    if (resp.status === 429) {
      const retryAfter = parseInt(resp.headers.get("Retry-After") ?? "10", 10);
      if (retryAfter > 30) {
        const hours = (retryAfter / 3600).toFixed(1);
        logger.error(`Rate limited on ${endpoint} for ${hours}h (Retry-After=${retryAfter}s), failing immediately`);
        return resp;
      }
      const waitSecs = Math.max(retryAfter, 5);
      logger.warn(`Rate limited on ${endpoint}, Retry-After=${retryAfter}s, waiting ${waitSecs}s...`);
      await new Promise((r) => setTimeout(r, waitSecs * 1000));
      continue;
    }

    if (!resp.ok) {
      const body = await resp.text();
      logger.error(`API ${resp.status} ${endpoint}: ${body}`);
    }
    return resp;
  }

  // All retries exhausted — return a failed response
  logger.error(`All retries exhausted for ${endpoint}`);
  return new Response(null, { status: 429, statusText: "Rate limited" });
}

export type SpotifyTrack = {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
};

export type CurrentlyPlaying = {
  is_playing: boolean;
  item: SpotifyTrack | null;
  currently_playing_type: string;
};

export type PlaylistInfo = {
  id: string;
  name: string;
  tracks: number;
};

export async function getCurrentTrack(): Promise<CurrentlyPlaying | null> {
  const resp = await apiFetch("/me/player/currently-playing");
  if (resp.status === 204 || resp.status === 202) {
    logger.info("No track currently playing (204/202)");
    return null;
  }
  if (!resp.ok) throw new Error(`Get current track: ${resp.status}`);
  const data = (await resp.json()) as CurrentlyPlaying;
  if (data.currently_playing_type !== "track") {
    logger.info(`Currently playing type is '${data.currently_playing_type}', not a track`);
    return null;
  }
  logger.info(`Current track: ${data.item?.name} (${data.item?.id})`);
  return data;
}

export async function areItemsSaved(uris: string[]): Promise<boolean[]> {
  const resp = await apiFetch(`/me/library/contains?uris=${encodeURIComponent(uris.join(","))}`);
  if (!resp.ok) throw new Error(`Check saved: ${resp.status}`);
  return (await resp.json()) as boolean[];
}

export async function saveToLibrary(uris: string[]): Promise<void> {
  const resp = await apiFetch(`/me/library?uris=${encodeURIComponent(uris.join(","))}`, { method: "PUT" });
  if (!resp.ok) throw new Error(`Save to library: ${resp.status}`);
  logger.info(`Saved to library: ${uris.join(", ")}`);
}

export async function removeFromLibrary(uris: string[]): Promise<void> {
  const resp = await apiFetch(`/me/library?uris=${encodeURIComponent(uris.join(","))}`, { method: "DELETE" });
  if (!resp.ok) throw new Error(`Remove from library: ${resp.status}`);
}

// Cache playlists and prevent concurrent/rapid fetches
let playlistCache: { data: PlaylistInfo[]; timestamp: number } | null = null;
let playlistFetchInProgress: Promise<PlaylistInfo[]> | null = null;
let lastFetchError = 0; // timestamp of last error, used as cooldown
const CACHE_TTL = 120_000; // 2 minutes
const ERROR_COOLDOWN = 60_000; // 1 minute cooldown after errors

export async function getUserPlaylists(): Promise<PlaylistInfo[]> {
  if (playlistCache && Date.now() - playlistCache.timestamp < CACHE_TTL) {
    logger.info(`Returning ${playlistCache.data.length} cached playlists`);
    return playlistCache.data;
  }

  // If we recently got an error, return cache (even stale) or empty
  if (lastFetchError && Date.now() - lastFetchError < ERROR_COOLDOWN) {
    logger.info("In error cooldown, skipping fetch");
    return playlistCache?.data ?? [];
  }

  // Deduplicate concurrent requests
  if (playlistFetchInProgress) {
    logger.info("Fetch already in progress, waiting...");
    return playlistFetchInProgress;
  }

  playlistFetchInProgress = fetchPlaylistsInternal();
  try {
    return await playlistFetchInProgress;
  } finally {
    playlistFetchInProgress = null;
  }
}

async function fetchPlaylistsInternal(): Promise<PlaylistInfo[]> {
  const all: PlaylistInfo[] = [];
  let offset = 0;
  for (let p = 0; p < 4; p++) {
    const resp = await apiFetch(`/me/playlists?limit=50&offset=${offset}`);
    if (!resp.ok) {
      // If we already have some playlists, return what we got instead of failing
      if (all.length > 0) {
        logger.warn(`Page ${p} failed (${resp.status}), returning ${all.length} playlists fetched so far`);
        break;
      }
      lastFetchError = Date.now();
      throw new Error(`Get playlists: ${resp.status}`);
    }
    const data = (await resp.json()) as { items: Record<string, unknown>[]; next: string | null };
    for (const raw of (data.items ?? [])) {
      if (!raw) continue;
      // Spotify API returns track info as either "tracks" or "items" depending on version
      const trackObj = (raw.tracks ?? raw.items) as { total?: number } | undefined;
      all.push({
        id: raw.id as string,
        name: raw.name as string,
        tracks: trackObj?.total ?? 0,
      });
    }
    logger.info(`Playlists page ${p}: ${data.items?.length} items`);
    if (!data.next) break;
    offset += 50;
  }

  playlistCache = { data: all, timestamp: Date.now() };
  lastFetchError = 0;
  logger.info(`Fetched ${all.length} playlists total`);
  return all;
}

export async function addItemsToPlaylist(playlistId: string, uris: string[]): Promise<void> {
  const resp = await apiFetch(`/playlists/${playlistId}/items`, {
    method: "POST",
    body: JSON.stringify({ uris }),
  });
  if (!resp.ok) throw new Error(`Add to playlist: ${resp.status}`);
  logger.info(`Added to playlist ${playlistId}: ${uris.join(", ")}`);
}

export async function likeAndAddToPlaylist(
  trackUri: string, playlistId: string
): Promise<{ liked: boolean; addedToPlaylist: boolean; errors: string[] }> {
  const errors: string[] = [];
  const [likeResult, playlistResult] = await Promise.allSettled([
    saveToLibrary([trackUri]),
    addItemsToPlaylist(playlistId, [trackUri]),
  ]);

  if (likeResult.status === "rejected") {
    const msg = likeResult.reason instanceof Error ? likeResult.reason.message : String(likeResult.reason);
    logger.error(`Like failed: ${msg}`);
    errors.push(`Like: ${msg}`);
  }
  if (playlistResult.status === "rejected") {
    const msg = playlistResult.reason instanceof Error ? playlistResult.reason.message : String(playlistResult.reason);
    logger.error(`Add to playlist failed: ${msg}`);
    errors.push(`Playlist: ${msg}`);
  }

  return {
    liked: likeResult.status === "fulfilled",
    addedToPlaylist: playlistResult.status === "fulfilled",
    errors,
  };
}
