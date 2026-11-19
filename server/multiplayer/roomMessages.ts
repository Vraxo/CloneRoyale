import type { MessageHandlerOptions, ServerClient, ClientMessage } from "../core/types.js";

export function createRoomMessageHandlers(options: MessageHandlerOptions): Record<string, (client: ServerClient, message: ClientMessage) => void> {
  const { send, rooms, matchmaking, createRoom, leaveRoom, attachPlayer, sendRoom } = options;

  return {
    "create-room"(client) {
      matchmaking.remove(client);
      if (client.room) leaveRoom(client);
      createRoom(client);
    },

    "join-room"(client, message) {
      const room = rooms.get(String(message.code ?? "").trim().toUpperCase());
      if (!room) {
        send(client, { type: "error", message: "Room not found. Check the code and try again." });
        return;
      }
      if (client.room === room) {
        sendRoom(room);
        return;
      }
      if (room.players.size >= 2 || room.state) {
        send(client, { type: "error", message: "That room is already full." });
        return;
      }
      matchmaking.remove(client);
      if (client.room) leaveRoom(client);
      if (rooms.get(room.code) !== room || room.players.size >= 2 || room.state) {
        send(client, { type: "error", message: "That room is no longer available." });
        return;
      }
      attachPlayer(room, client, "red");
    },

    "leave-room"(client) {
      matchmaking.remove(client);
      leaveRoom(client);
    }
  };
}
