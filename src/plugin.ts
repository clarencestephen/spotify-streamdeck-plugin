import streamDeck from "@elgato/streamdeck";

import { AuthorizeAction } from "./actions/authorize";
import { LikeTrackAction } from "./actions/like-track";
import { AddToPlaylistAction } from "./actions/add-to-playlist";
import { LikeAndAddAction } from "./actions/like-and-add";

streamDeck.actions.registerAction(new AuthorizeAction());
streamDeck.actions.registerAction(new LikeTrackAction());
streamDeck.actions.registerAction(new AddToPlaylistAction());
streamDeck.actions.registerAction(new LikeAndAddAction());

streamDeck.connect();
