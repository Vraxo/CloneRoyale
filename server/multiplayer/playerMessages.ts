import type { ClientMessage, MessageHandlerOptions, ServerClient } from "../core/types.js";

export function createPlayerMessageHandlers(options: MessageHandlerOptions): Record<string, (client: ServerClient, message: ClientMessage) => void> {
  const { broadcast, playerSummaries, resumePlayer, send, broadcastGlobal, getGlobalChatHistory } = options;

  return {
    "global-chat-history"(client) {
      send(client, { type: "global-chat-history", messages: getGlobalChatHistory() });
    },

    "global-chat"(client, message) {
      if (client.closed || client.disconnected) return;
      const rawText = typeof message.text === "string" ? message.text : "";
      const text = rawText.replace(/[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/g, "").trim().slice(0, 200);
      if (!text) return;
      const now = Date.now();
      if (now - (client.lastGlobalChatAt ?? 0) < 1200) return;
      client.lastGlobalChatAt = now;
      const entry = { id: client.id, name: client.name, text, timestamp: now };
      const history = getGlobalChatHistory();
      history.push(entry);
      if (history.length > 50) history.splice(0, history.length - 50);
      broadcastGlobal({ type: "global-chat-message", message: entry });
    },

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
