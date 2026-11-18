import type { CardId, GameState, Side } from "../game/types";
import type { BattleReplay } from "../game/replay";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";
export type OnlineMessage =
  | { type: "connection-status"; state: ConnectionState }
  | { type: "connected" }
  | { type: "assigned"; side: Side; code: string | null; publicMatch?: boolean; resumeToken?: string; name?: string }
  | { type: "players-updated"; players: { side: Side; name: string }[] }
  | { type: "resumed"; side: Side; code: string | null; publicMatch?: boolean; state: GameState | null; resumeToken: string; name?: string; players?: { side: Side; name: string }[] }
  | { type: "resume-failed" }
  | { type: "connection-lost" }
  | { type: "opponent-disconnected"; graceSeconds: number }
  | { type: "opponent-reconnected"; side: Side }
  | { type: "queue-status"; waiting: number; position?: number }
  | { type: "queue-cancelled" }
  | { type: "room"; code: string; players: { side: Side; name: string }[]; status: "waiting" | "playing" }
  | { type: "match-start"; state: GameState; players?: { side: Side; name: string }[] }
  | { type: "rematch-status"; ready: number; total: number }
  | { type: "rematch-start"; state: GameState; players?: { side: Side; name: string }[] }
  | { type: "state"; state: GameState }
  | { type: "match-replay"; replay: BattleReplay; shareToken?: string }
  | { type: "emote"; side: Side; emoteId: number; name: string }
  | { type: "opponent-left" }
  | { type: "action-error"; message: string }
  | { type: "error"; message: string };

export class OnlineClient {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<(message: OnlineMessage) => void>();
  private reconnectEnabled = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionPromise: Promise<void> | null = null;
  private reconnectAttempts = 0;
  private connectionState: ConnectionState = "disconnected";

  public connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connectionPromise) return this.connectionPromise;

    const configured = import.meta.env.VITE_MULTIPLAYER_SERVER_URL;
    const url = configured
      ? configured.replace(/^http/, "ws").replace(/\/$/, "") + "/ws"
      : (window.location.protocol === "https:" ? "wss://" : "ws://")
        + window.location.hostname + (import.meta.env.DEV ? ":3001" : (window.location.port ? ":" + window.location.port : "")) + "/ws";

    this.reconnectEnabled = true;
    this.setConnectionState(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");
    const socket = new WebSocket(url);
    this.socket = socket;

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        this.connectionPromise = null;
        if (error) reject(error);
        else {
          this.reconnectAttempts = 0;
          this.setConnectionState("connected");
          resolve();
        }
      };

      socket.addEventListener("open", () => finish(), { once: true });
      socket.addEventListener("error", () => finish(new Error("Could not connect to the game server.")), { once: true });
      socket.addEventListener("message", event => {
        try {
          const message = JSON.parse(String(event.data)) as OnlineMessage;
          for (const listener of this.listeners) listener(message);
        } catch { /* Ignore malformed messages. */ }
      });
      socket.addEventListener("close", () => {
        if (this.socket === socket) this.socket = null;
        finish(new Error("The connection to the game server was closed."));
        if (!this.reconnectEnabled) {
          this.setConnectionState("disconnected");
          return;
        }
        for (const listener of this.listeners) listener({ type: "connection-lost" });
        this.scheduleReconnect();
      });
    });
    return this.connectionPromise;
  }

  public subscribe(listener: (message: OnlineMessage) => void): () => void {
    this.listeners.add(listener);
    listener({ type: "connection-status", state: this.connectionState });
    return () => this.listeners.delete(listener);
  }

  public get isConnected(): boolean { return this.socket?.readyState === WebSocket.OPEN; }

  public setProfile(guestId: string, name: string): void {
    this.send({ type: "set-profile", guestId, name });
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
  public sendEmote(emoteId: number): void { this.send({ type: "emote", emoteId }); }

  public leave(): void {
    this.reconnectEnabled = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    localStorage.removeItem("cloneroyale.resume-token");
    this.send({ type: "cancel-matchmaking" });
    this.send({ type: "leave-room" });
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.setConnectionState("disconnected");
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    for (const listener of this.listeners) listener({ type: "connection-status", state });
  }

  private scheduleReconnect(): void {
    if (!this.reconnectEnabled || this.reconnectTimer) return;
    this.reconnectAttempts++;
    const baseDelay = Math.min(30000, 1000 * (2 ** Math.min(this.reconnectAttempts - 1, 5)));
    const delay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
    this.setConnectionState("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.reconnect();
    }, delay);
  }

  private async reconnect(): Promise<void> {
    if (!this.reconnectEnabled) return;
    try {
      await this.connect();
      this.resume();
    } catch {
      if (this.reconnectEnabled) this.scheduleReconnect();
    }
  }

  private send(message: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
}
