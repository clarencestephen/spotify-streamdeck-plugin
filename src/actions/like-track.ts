import streamDeck, { action, type KeyAction, type KeyDownEvent, SingletonAction, type WillAppearEvent } from "@elgato/streamdeck";
import { spotifyAuth } from "../spotify-auth";
import { getCurrentTrack, areItemsSaved, saveToLibrary, removeFromLibrary } from "../spotify-api";

const logger = streamDeck.logger.createScope("LikeTrack");

@action({ UUID: "com.cognosis.spotify-controller.like-track" })
export class LikeTrackAction extends SingletonAction {

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastTrackUri: string | null = null;
  private isLiked = false;

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    await ev.action.setTitle("Like");
    this.startPolling(ev);
  }

  override async onWillDisappear(): Promise<void> {
    this.stopPolling();
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    if (!spotifyAuth.isAuthorized) {
      await ev.action.setTitle("Auth\nFirst!");
      await ev.action.showAlert();
      return;
    }

    try {
      const cur = await getCurrentTrack();
      if (!cur?.item) {
        await ev.action.setTitle("No\nTrack");
        await ev.action.showAlert();
        return;
      }

      if (this.isLiked) {
        await removeFromLibrary([cur.item.uri]);
        this.isLiked = false;
        await ev.action.setState(0);
        await ev.action.setTitle("Unliked");
        logger.info(`Unliked: ${cur.item.name}`);
      } else {
        await saveToLibrary([cur.item.uri]);
        this.isLiked = true;
        await ev.action.setState(1);
        await ev.action.setTitle("Liked!");
        logger.info(`Liked: ${cur.item.name}`);
      }
      await ev.action.showOk();

      setTimeout(async () => {
        try { await ev.action.setTitle(this.isLiked ? "Liked" : "Like"); } catch {}
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Like toggle error: ${msg}`);
      await ev.action.setTitle("Error");
      await ev.action.showAlert();
      setTimeout(async () => {
        try { await ev.action.setTitle(this.isLiked ? "Liked" : "Like"); } catch {}
      }, 2000);
    }
  }

  private startPolling(ev: WillAppearEvent): void {
    this.stopPolling();
    const keyAction = ev.action as KeyAction;
    const poll = async () => {
      if (!spotifyAuth.isAuthorized) return;
      try {
        const cur = await getCurrentTrack();
        if (!cur?.item) return;

        if (cur.item.uri !== this.lastTrackUri) {
          this.lastTrackUri = cur.item.uri;
          const [saved] = await areItemsSaved([cur.item.uri]);
          this.isLiked = saved;
          await keyAction.setState(saved ? 1 : 0);
          await keyAction.setTitle(saved ? "Liked" : "Like");
        }
      } catch (err) {
        logger.debug(`Poll error: ${err instanceof Error ? err.message : err}`);
      }
    };
    poll();
    this.pollTimer = setInterval(poll, 10_000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
