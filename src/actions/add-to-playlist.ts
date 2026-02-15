import streamDeck, {
  action,
  type KeyAction,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
  type WillDisappearEvent,
  type DidReceiveSettingsEvent,
  type SendToPluginEvent,
} from "@elgato/streamdeck";
import type { JsonObject, JsonValue } from "@elgato/utils";
import { spotifyAuth } from "../spotify-auth";
import { getCurrentTrack, addItemsToPlaylist, removeItemsFromPlaylist, isTrackInPlaylist, isRateLimited } from "../spotify-api";
import { handlePlaylistPI } from "./playlist-pi-handler";

const logger = streamDeck.logger.createScope("AddToPlaylist");

type Settings = { playlistId?: string; playlistName?: string };

@action({ UUID: "com.cognosis.spotify-controller.add-to-playlist" })
export class AddToPlaylistAction extends SingletonAction {

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastTrackUri: string | null = null;
  private inPlaylist = false;

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    this.startPolling(ev);
  }

  override async onWillDisappear(_ev: WillDisappearEvent): Promise<void> {
    this.stopPolling();
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent): Promise<void> {
    // Reset state when settings change (new playlist selected)
    this.lastTrackUri = null;
    this.inPlaylist = false;
    await ev.action.setState(0);
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, JsonObject>): Promise<void> {
    await handlePlaylistPI(ev.payload as Record<string, unknown>);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    if (!spotifyAuth.isAuthorized) {
      await ev.action.setTitle("Auth\nFirst!");
      await ev.action.showAlert();
      return;
    }

    const s = (ev.payload.settings ?? {}) as Settings;
    if (!s.playlistId) {
      await ev.action.setTitle("Set\nPlaylist");
      await ev.action.showAlert();
      return;
    }

    try {
      const cur = await getCurrentTrack();
      if (!cur?.item) { await ev.action.setTitle("No\nTrack"); await ev.action.showAlert(); return; }

      const trackName = trunc(cur.item.name, 12);

      if (this.inPlaylist) {
        // State 1 (removal icon showing) — REMOVE from playlist
        await removeItemsFromPlaylist(s.playlistId, [cur.item.uri]);
        this.inPlaylist = false;
        await ev.action.setState(0);
        await ev.action.setTitle(`Removed\n${trackName}`);
        await ev.action.showOk();
        logger.info(`Removed from playlist: ${cur.item.name}`);
      } else {
        // State 0 (add icon showing) — check for duplicates first, then ADD
        const alreadyIn = await isTrackInPlaylist(s.playlistId, cur.item.uri);
        if (alreadyIn) {
          // Song already on playlist — show message, switch to removal state
          this.inPlaylist = true;
          await ev.action.setState(1);
          await ev.action.setTitle(`Already\nOn List`);
          await ev.action.showAlert();
          logger.info(`Already in playlist: ${cur.item.name}`);
          setTimeout(async () => { try { await ev.action.setTitle(""); } catch {} }, 2500);
          return;
        }

        await addItemsToPlaylist(s.playlistId, [cur.item.uri]);
        this.inPlaylist = true;
        await ev.action.setState(1);
        await ev.action.setTitle(`Added!\n${trackName}`);
        await ev.action.showOk();
        logger.info(`Added to playlist: ${cur.item.name}`);
      }

      setTimeout(async () => { try { await ev.action.setTitle(""); } catch {} }, 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Error: ${msg}`);
      await ev.action.setTitle("Error");
      await ev.action.showAlert();
      setTimeout(async () => { try { await ev.action.setTitle(""); } catch {} }, 2500);
    }
  }

  private startPolling(ev: WillAppearEvent): void {
    this.stopPolling();
    const keyAction = ev.action as KeyAction;
    const poll = async () => {
      if (!spotifyAuth.isAuthorized || isRateLimited()) return;
      try {
        const s = (await keyAction.getSettings()) as Settings;
        if (!s.playlistId) return;

        const cur = await getCurrentTrack();
        if (!cur?.item) return;

        // When track changes, check if it's in the playlist
        if (cur.item.uri !== this.lastTrackUri) {
          this.lastTrackUri = cur.item.uri;
          if (!isRateLimited()) {
            const inPl = await isTrackInPlaylist(s.playlistId, cur.item.uri);
            this.inPlaylist = inPl;
            await keyAction.setState(inPl ? 1 : 0);
            await keyAction.setTitle("");
          }
        }
      } catch (err) {
        logger.debug(`Poll error: ${err instanceof Error ? err.message : err}`);
      }
    };
    poll();
    this.pollTimer = setInterval(poll, 60_000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.substring(0, n - 1) + "…" : s;
}
