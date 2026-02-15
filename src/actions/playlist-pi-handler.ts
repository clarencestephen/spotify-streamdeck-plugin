import streamDeck from "@elgato/streamdeck";
import { spotifyAuth } from "../spotify-auth";
import { getUserPlaylists } from "../spotify-api";

const logger = streamDeck.logger.createScope("PlaylistPI");

export async function handlePlaylistPI(
  payload: Record<string, unknown>
): Promise<void> {
  if (payload?.event !== "getPlaylists") return;

  if (!spotifyAuth.isAuthorized) {
    logger.warn("Not authorized when fetching playlists");
    await streamDeck.ui.sendToPropertyInspector({
      event: "error",
      message: "Not authorized. Press Authorize first.",
    });
    return;
  }

  try {
    const playlists = await getUserPlaylists();
    logger.info(`Sending ${playlists.length} playlists to PI`);
    await streamDeck.ui.sendToPropertyInspector({
      event: "playlists",
      playlists,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error(`Failed to fetch playlists: ${msg}`);
    await streamDeck.ui.sendToPropertyInspector({
      event: "error",
      message: `Failed: ${msg}`,
    });
  }
}
