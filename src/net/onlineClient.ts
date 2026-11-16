import type { CardId, GameState, Side } from "../game/types";

export type OnlineMessage =
  | { type: "connected" }
  | { type: "assigned"; side: Side; code: string | null; publicMatch?: boolean; resumeToken?: string }
  | { type: "resumed"; side: Side; code: string | null; publicMatch?: boolean; state: GameState | null; resumeToken: string }
  | { type: "resume-failed" }
  | { type: "connection-lost" }
  | { type: "opponent-disconnected"; graceSeconds: number }
  | { type: "opponent-reconnected"; side: Side }
  | { type: "queue-status"; waiting: number }
  | { type: "queue-cancelled" }
  | { type: "room"; code: string; players: { side: Side; name: string }[]; status: "waiting" | "playing" }
  | { type: "match-start"; state: GameState }
  | { type: "rematch-status"; ready: number; total: number }
  | { type: "rematch-start"; state: GameState }
  | { type: "state"; state: GameState }
  | { type: "opponent-left" }
  | { type: "action-error"; message: string }
  | { type: "error"; message: string };

export class OnlineClient {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<(message: OnlineMessage) => void>();
  private reconnectEnabled = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  public connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    const configured = import.meta.env.VITE_MULTIPLAYER_SERVER_URL;
    const url = configured
      ? configured.replace(/^http/, "ws").replace(/\/$/, "") + "/ws"
      : (window.location.protocol === "https:" ? "wss://" : "ws://")
        + window.location.hostname + (import.meta.env.DEV ? ":3001" : (window.location.port ? ":" + window.location.port : "")) + "/ws";
    this.reconnectEnabled = true;
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
        if (this.socket === socket) this.socket = null;
        if (!this.reconnectEnabled) return;
        for (const listener of this.listeners) listener({ type: "connection-lost" });
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; void this.reconnect(); }, 1200);
      });
    });
  }

  public subscribe(listener: (message: OnlineMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public resume(): void {
    const token = localStorage.getItem("cloneroyale.resume-token");
    if (token) this.send({ type: "resume", token });
  }

  public findMatch(): void { this.send({ type: "find-match" }); }
  public cancelMatchmaking(): void { this.send({ type: "cancel-matchmaking" }); }
  public createRoom(): void { this.send({ type: "create-room" }); }
  public joinRoom(code: string): void { this.send({ type: "join-room", code }); }
  public playCard(cardId: CardId, x: number, y: number): void { this.send({ type: "play-card", cardId, x, y }); }
  public requestRematch(): void { this.send({ type: "rematch-ready" }); }

  public leave(): void {
    this.reconnectEnabled = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    localStorage.removeItem("cloneroyale.resume-token");
    this.send({ type: "cancel-matchmaking" });
    this.send({ type: "leave-room" });
    this.socket?.close();
    this.socket = null;
  }

  private async reconnect(): Promise<void> {
    if (!this.reconnectEnabled) return;
    try { await this.connect(); this.resume(); }
    catch {
      if (!this.reconnectEnabled) return;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; void this.reconnect(); }, 2000);
    }
  }

  private send(message: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
}
