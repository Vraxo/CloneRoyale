import { canPlaceCard, snapToArenaTile, playCard } from "./simulation.js";
import type { CardId } from "../src/game/types.js";
import type { ClientMessage, MessageHandlerOptions, ServerClient } from "./types.js";

export function createMatchMessageHandlers(options: MessageHandlerOptions): Record<string, (client: ServerClient, message: ClientMessage) => void> {
  const { send, broadcast, matchmaking, requestRematch } = options;

  return {
    "find-match"(client) {
      matchmaking.join(client);
    },

    "cancel-matchmaking"(client) {
      matchmaking.remove(client, true);
    },

    "rematch-ready"(client) {
      requestRematch(client);
    },

    "play-card"(client, message) {
      if (!client.room?.state || !client.side) return;
      const room = client.room;
      const state = room.state;
      const side = client.side;
      if (state.gameOver) return;
      const cardId = message.cardId;
      const x = Number(message.x);
      const y = Number(message.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || typeof cardId !== "string") return;
      const point = snapToArenaTile({ x, y });
      if (!canPlaceCard(state, side, cardId as CardId, point.x, point.y)) {
        send(client, { type: "action-error", message: "That card cannot be deployed there." });
        return;
      }
      const lane = point.x < 360 ? "left" : "right";
      if (!playCard(state, side, cardId as CardId, lane, point.x, point.y, point)) {
        send(client, { type: "action-error", message: "That card is no longer available." });
        return;
      }
      room.replayRecorder?.record(state, side, cardId as CardId, point.x, point.y);
      broadcast(room, { type: "state", state });
      state.audioEvents = [];
    }
  };
}
