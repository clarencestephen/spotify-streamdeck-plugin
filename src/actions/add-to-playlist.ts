import {
  action,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent,
  type DidReceiveSettingsEvent,
  type SendToPluginEvent,
} from "@elgato/streamdeck";
import type { JsonObject, JsonValue } from "@elgato/utils";
import { spotifyAuth } from "../spotify-auth";
import { getCurrentTrack, addItemsToPlaylist } from "../spotify-api";
import { handlePlaylistPI } from "./playlist-pi-handler";

type Settings = { playlistId?: string; playlistName?: string };

@action({ UUID: "com.cognosis.spotify-controller.add-to-playlist" })
export class AddToPlaylistAction extends SingletonAction {

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    const s = (ev.payload.settings ?? {}) as Settings;
    await ev.action.setTitle(s.playlistName ? trunc(s.playlistName, 10) : "+ List");
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent): Promise<void> {
    const s = (ev.payload.settings ?? {}) as Settings;
    if (s.playlistName) await ev.action.setTitle(trunc(s.playlistName, 10));
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

      await addItemsToPlaylist(s.playlistId, [cur.item.uri]);
      await ev.action.setTitle(`Added!\n${trunc(cur.item.name, 12)}`);
      await ev.action.showOk();
      setTimeout(async () => { try { await ev.action.setTitle(trunc(s.playlistName || "+ List", 10)); } catch {} }, 2500);
    } catch {
      await ev.action.setTitle("Error");
      await ev.action.showAlert();
    }
  }
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.substring(0, n - 1) + "…" : s;
}
