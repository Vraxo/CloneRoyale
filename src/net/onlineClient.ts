import type { CardId, GameState, Side } from "../game/types";

export type OnlineMessage =
  | { type: "connected" }
  | { type: "assigned"; side: Side; code: string | null; publicMatch?: boolean }
  | { type: "queue-status"; waiting: number }
  | { type: "queue-cancelled" }
  | { type: "room"; code: string; players: { side: Side; name: string }[]; status: "waiting" | "playing" }
  | { type: "match-start"; state: GameState }
  | { type: "state"; state: GameState }
  | { type: "opponent-left" }
  | { type: "action-error"; message: string }
  | { type: "error"; message: string };

export class OnlineClient {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<(message: OnlineMessage) => void>();

  public connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    const configured = import.meta.env.VITE_MULTIPLAYER_SERVER_URL;
    const url = configured
      ? configured.replace(/^http/, "ws").replace(/\/$/, "") + "/ws"
      : (window.location.protocol === "https:" ? "wss://" : "ws://")
        + window.location.hostname + (import.meta.env.DEV ? ":3001" : (window.location.port ? ":" + window.location.port : "")) + "/ws";
    this.socket = new WebSocket(url);
    return new Promise((resolve, reject) => {
      const socket = this.socket!;
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("Could not connect to the game server.")), { once: true });
      socket.addEventListener("message", event => {
        try {
          const message = JSON.parse(String(event.data)) as OnlineMessage;
          for (const listener of this.listeners) listener(message);
        } catch { /* Ignore malformed messages. */ }
      });
      socket.addEventListener("close", () => {
        for (const listener of this.listeners) listener({ type: "opponent-left" });
      });
    });
  }

  public subscribe(listener: (message: OnlineMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public findMatch(): void { this.send({ type: "find-match" }); }
  public cancelMatchmaking(): void { this.send({ type: "cancel-matchmaking" }); }
  public createRoom(): void { this.send({ type: "create-room" }); }
  public joinRoom(code: string): void { this.send({ type: "join-room", code }); }
  public playCard(cardId: CardId, x: number, y: number): void { this.send({ type: "play-card", cardId, x, y }); }

  public leave(): void {
    this.send({ type: "cancel-matchmaking" });
    this.send({ type: "leave-room" });
    this.socket?.close();
    this.socket = null;
  }

  private send(message: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
}
