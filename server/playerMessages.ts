import type { ClientMessage, MessageHandlerOptions, ServerClient } from "./types.js";

export function createPlayerMessageHandlers(options: MessageHandlerOptions): Record<string, (client: ServerClient, message: ClientMessage) => void> {
  const { broadcast, playerSummaries, resumePlayer } = options;

  return {
    emote(client, message) {
      const room = client.room;
      const emoteId = message.emoteId;
      if (!room?.state || !client.side || client.disconnected) return;
      if (!Number.isInteger(emoteId) || (emoteId as number) < 0 || (emoteId as number) >= 12) return;
      const now = Date.now();
      if (now - (client.lastEmoteAt ?? 0) < 1200) return;
      client.lastEmoteAt = now;
      broadcast(room, { type: "emote", side: client.side, emoteId, name: client.name });
    },

    resume(client, message) {
      resumePlayer(client, message.token);
    },

    "set-profile"(client, message) {
      const rawName = typeof message.name === "string" ? message.name : "";
      const name = rawName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 16) || "Guest";
      const guestId = client.accountId ?? (typeof message.guestId === "string" && /^[a-f0-9-]{36}$/i.test(message.guestId)
        ? message.guestId : client.guestId);
      client.guestId = guestId;
      client.name = name;
      if (client.room) broadcast(client.room, { type: "players-updated", players: playerSummaries(client.room) });
    }
  };
}
