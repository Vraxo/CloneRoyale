import { canPlaceCard, snapToArenaTile, playCard } from "../dist-server/simulation.js";

export function createMatchMessageHandlers(options) {
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
      const state = client.room.state;
      const side = client.side;
      if (state.gameOver) return;
      const cardId = message.cardId;
      const x = Number(message.x);
      const y = Number(message.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || typeof cardId !== "string") return;
      const point = snapToArenaTile({ x, y });
      if (!canPlaceCard(state, side, cardId, point.x, point.y)) {
        send(client, { type: "action-error", message: "That card cannot be deployed there." });
        return;
      }
      const lane = point.x < 360 ? "left" : "right";
      if (!playCard(state, side, cardId, lane, point.x, point.y, point)) {
        send(client, { type: "action-error", message: "That card is no longer available." });
        return;
      }
      client.room.replayRecorder?.record(state, side, cardId, point.x, point.y);
      broadcast(client.room, { type: "state", state });
      state.audioEvents = [];
    }
  };
}
