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
import {
  getCurrentTrack,
  areItemsSaved,
  isTrackInPlaylist,
  likeAndAddToPlaylist,
  unlikeAndRemoveFromPlaylist,
  isRateLimited,
} from "../spotify-api";
import { handlePlaylistPI } from "./playlist-pi-handler";

const logger = streamDeck.logger.createScope("LikeAndAdd");

type Settings = { playlistId?: string; playlistName?: string };

@action({ UUID: "com.cognosis.spotify-controller.like-and-add" })
export class LikeAndAddAction extends SingletonAction {

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastTrackUri: string | null = null;
  private isDone = false; // true when both liked AND in playlist

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    this.startPolling(ev);
  }

  override async onWillDisappear(_ev: WillDisappearEvent): Promise<void> {
    this.stopPolling();
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent): Promise<void> {
    this.lastTrackUri = null;
    this.isDone = false;
    await ev.action.setState(0);
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, JsonObject>): Promise<void> {
    await handlePlaylistPI(ev.payload as Record<string, unknown>);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    if (!spotifyAuth.isAuthorized) {
      logger.warn("Not authorized");
      await ev.action.setTitle("Auth\nFirst!");
      await ev.action.showAlert();
      return;
    }

    const s = (ev.payload.settings ?? {}) as Settings;
    if (!s.playlistId) {
      logger.error("No playlist selected — open Property Inspector to choose one");
      await ev.action.setTitle("Set\nPlaylist");
      await ev.action.showAlert();
      return;
    }

    try {
      const cur = await getCurrentTrack();
      if (!cur?.item) {
        logger.warn("No track currently playing");
        await ev.action.setTitle("No\nTrack");
        await ev.action.showAlert();
        return;
      }

      const trackName = trunc(cur.item.name, 12);

      if (this.isDone) {
        // State 1 (removal icon showing) — UNDO: unlike + remove from playlist
        logger.info(`Undo: ${cur.item.name} — unlike + remove from ${s.playlistName}`);
        const result = await unlikeAndRemoveFromPlaylist(cur.item.uri, s.playlistId);

        if (result.errors.length === 0) {
          this.isDone = false;
          await ev.action.setState(0);
          await ev.action.setTitle(`Undone!\n${trackName}`);
          await ev.action.showOk();
          logger.info("Both unlike and remove succeeded");
        } else if (result.removedFromPlaylist) {
          this.isDone = false;
          await ev.action.setState(0);
          await ev.action.setTitle(`Removed\n(like err)`);
          await ev.action.showOk();
        } else if (result.unliked) {
          await ev.action.setTitle(`Unliked\n(rm err)`);
          await ev.action.showAlert();
        } else {
          await ev.action.setTitle("Error");
          await ev.action.showAlert();
          logger.error(`Both failed: ${result.errors.join(", ")}`);
        }
      } else {
        // State 0 (add icon showing) — check for duplicates first
        const [savedArr, inPl] = await Promise.all([
          areItemsSaved([cur.item.uri]),
          isTrackInPlaylist(s.playlistId, cur.item.uri),
        ]);
        const isLiked = savedArr[0];

        if (isLiked && inPl) {
          // Already liked AND in playlist — show message, switch to removal state
          this.isDone = true;
          await ev.action.setState(1);
          await ev.action.setTitle(`Already\nDone`);
          await ev.action.showAlert();
          logger.info(`Already liked and in playlist: ${cur.item.name}`);
          setTimeout(async () => { try { await ev.action.setTitle(""); } catch {} }, 2500);
          return;
        }

        // Do the action: like + add (skips parts already done)
        logger.info(`Like + Add: ${cur.item.name} to ${s.playlistName}`);
        const result = await likeAndAddToPlaylist(cur.item.uri, s.playlistId);

        if (result.errors.length === 0) {
          this.isDone = true;
          await ev.action.setState(1);
          await ev.action.setTitle(`Done!\n${trackName}`);
          await ev.action.showOk();
          logger.info("Both like and add succeeded");
        } else if (result.addedToPlaylist) {
          this.isDone = true;
          await ev.action.setState(1);
          await ev.action.setTitle(`Added!\n(like err)`);
          await ev.action.showOk();
        } else if (result.liked) {
          await ev.action.setTitle(`Liked!\n(add err)`);
          await ev.action.showAlert();
        } else {
          await ev.action.setTitle("Error");
          await ev.action.showAlert();
          logger.error(`Both failed: ${result.errors.join(", ")}`);
        }
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

        // When track changes, check if it's liked AND in the playlist
        if (cur.item.uri !== this.lastTrackUri) {
          this.lastTrackUri = cur.item.uri;
          if (!isRateLimited()) {
            const [savedArr, inPl] = await Promise.all([
              areItemsSaved([cur.item.uri]),
              isTrackInPlaylist(s.playlistId, cur.item.uri),
            ]);
            const bothDone = savedArr[0] && inPl;
            this.isDone = bothDone;
            await keyAction.setState(bothDone ? 1 : 0);
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
