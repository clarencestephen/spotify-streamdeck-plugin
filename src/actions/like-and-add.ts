import streamDeck, {
  action,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
} from "@elgato/streamdeck";
import { spotifyAuth } from "../spotify-auth";
import { getCurrentTrack, likeAndAddToPlaylist } from "../spotify-api";

const logger = streamDeck.logger.createScope("LikeAndAdd");

const PLAYLIST_ID = "0HGqu9QX72YoNhhVlj8TQH";
const PLAYLIST_NAME = "Stream Favs";

@action({ UUID: "com.cognosis.spotify-controller.like-and-add" })
export class LikeAndAddAction extends SingletonAction {

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    await ev.action.setTitle(PLAYLIST_NAME);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    if (!spotifyAuth.isAuthorized) {
      logger.warn("Not authorized");
      await ev.action.setTitle("Auth\nFirst!");
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

      logger.info(`Like + Add: ${cur.item.name} (${cur.item.uri}) to ${PLAYLIST_NAME}`);
      const result = await likeAndAddToPlaylist(cur.item.uri, PLAYLIST_ID);

      if (result.errors.length === 0) {
        await ev.action.setTitle(`Done!\n${cur.item.name.substring(0, 12)}`);
        await ev.action.showOk();
        logger.info("Both like and add succeeded");
      } else if (result.addedToPlaylist) {
        await ev.action.setTitle(`Added!\n(like err)`);
        await ev.action.showOk();
        logger.warn(`Added to playlist but like failed: ${result.errors.join(", ")}`);
      } else if (result.liked) {
        await ev.action.setTitle(`Liked!\n(add err)`);
        await ev.action.showAlert();
        logger.warn(`Liked but add to playlist failed: ${result.errors.join(", ")}`);
      } else {
        await ev.action.setTitle("Error");
        await ev.action.showAlert();
        logger.error(`Both failed: ${result.errors.join(", ")}`);
      }

      setTimeout(async () => {
        try { await ev.action.setTitle(PLAYLIST_NAME); } catch {}
      }, 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Error: ${msg}`);
      await ev.action.setTitle("Error");
      await ev.action.showAlert();
      setTimeout(async () => {
        try { await ev.action.setTitle(PLAYLIST_NAME); } catch {}
      }, 2500);
    }
  }
}
