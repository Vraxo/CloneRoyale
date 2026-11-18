import { createPlayerMessageHandlers } from "./playerMessages.mjs";
import { createRoomMessageHandlers } from "./roomMessages.mjs";
import { createMatchMessageHandlers } from "./matchMessages.mjs";

export function createClientMessageHandler(options) {
  const handlers = new Map([
    ...Object.entries(createPlayerMessageHandlers(options)),
    ...Object.entries(createRoomMessageHandlers(options)),
    ...Object.entries(createMatchMessageHandlers(options))
  ]);

  return function handleMessage(client, message) {
    if (!message || typeof message.type !== "string") return;
    handlers.get(message.type)?.(client, message);
  };
}
