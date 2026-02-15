import { action, type KeyDownEvent, SingletonAction, type WillAppearEvent } from "@elgato/streamdeck";
import { spotifyAuth } from "../spotify-auth";

@action({ UUID: "com.cognosis.spotify-controller.authorize" })
export class AuthorizeAction extends SingletonAction {
  private busy = false;

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    await ev.action.setTitle(spotifyAuth.isAuthorized ? "Connected" : "Connect");
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    if (this.busy) return;

    if (spotifyAuth.isAuthorized) {
      spotifyAuth.disconnect();
      await ev.action.setTitle("Connect");
      await ev.action.showOk();
      return;
    }

    try {
      this.busy = true;
      await ev.action.setTitle("Waiting...");
      await spotifyAuth.authorize();
      await ev.action.setTitle("Connected");
      await ev.action.showOk();
    } catch {
      await ev.action.setTitle("Failed");
      await ev.action.showAlert();
    } finally {
      this.busy = false;
    }
  }
}
