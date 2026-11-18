import { createPlayerMessageHandlers } from "./playerMessages.js";
import { createRoomMessageHandlers } from "./roomMessages.js";
import { createMatchMessageHandlers } from "./matchMessages.js";
import type { ClientMessage, MessageHandler, MessageHandlerOptions, ServerClient } from "./types.js";

export function createClientMessageHandler(options: MessageHandlerOptions): MessageHandler {
  const handlers = new Map<string, MessageHandler>([
    ...Object.entries(createPlayerMessageHandlers(options)),
    ...Object.entries(createRoomMessageHandlers(options)),
    ...Object.entries(createMatchMessageHandlers(options))
  ]);

  return function handleMessage(client: ServerClient, message: ClientMessage): void {
    if (!message || typeof message.type !== "string") return;
    handlers.get(message.type)?.(client, message);
  };
}
