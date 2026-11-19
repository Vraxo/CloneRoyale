import type { CardId } from "../game/types";
import type { OnlineMessage, ConnectionState } from "./onlineMessages";
import { parseOnlineMessage } from "./onlineMessages";
import { resolveOnlineUrl } from "./onlineUrl";

export type { ConnectionState, OnlineMessage } from "./onlineMessages";

export class OnlineClient {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<(message: OnlineMessage) => void>();
  private reconnectEnabled = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionPromise: Promise<void> | null = null;
  private cancelConnection: ((error: Error) => void) | null = null;
  private connectionGeneration = 0;
  private reconnectAttempts = 0;
  private connectionState: ConnectionState = "disconnected";

  public connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connectionPromise) return this.connectionPromise;

    this.reconnectEnabled = true;
    const generation = ++this.connectionGeneration;
    const url = resolveOnlineUrl(
      import.meta.env.VITE_MULTIPLAYER_SERVER_URL,
      window.location,
      import.meta.env.DEV
    );
    this.setConnectionState(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    const socket = new WebSocket(url);
    this.socket = socket;

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      let settled = false;

      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        if (generation === this.connectionGeneration) {
          this.connectionPromise = null;
          this.cancelConnection = null;
        }
        if (error) {
          reject(error);
          return;
        }
        if (generation !== this.connectionGeneration) return;
        this.reconnectAttempts = 0;
        this.setConnectionState("connected");
        resolve();
      };

      this.cancelConnection = error => finish(error);
      socket.addEventListener("open", () => {
        if (this.isCurrentSocket(socket, generation)) finish();
      }, { once: true });
      socket.addEventListener("error", () => {
        if (this.isCurrentSocket(socket, generation)) {
          finish(new Error("Could not connect to the game server."));
        }
      }, { once: true });
      socket.addEventListener("message", event => {
        if (!this.isCurrentSocket(socket, generation)) return;
        const message = parseOnlineMessage(event.data);
        if (message) this.notifyListeners(message);
      });
      socket.addEventListener("close", () => {
        if (!this.isCurrentSocket(socket, generation)) return;
        this.socket = null;
        finish(new Error("The connection to the game server was closed."));
        if (!this.reconnectEnabled) {
          this.setConnectionState("disconnected");
          return;
        }
        this.notifyListeners({ type: "connection-lost" });
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

  public get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  public setProfile(guestId: string, name: string): void {
    this.send({ type: "set-profile", guestId, name });
  }

  public resume(token: string | null): void {
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
    this.connectionGeneration++;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    const cancelConnection = this.cancelConnection;
    this.cancelConnection = null;
    this.connectionPromise = null;
    cancelConnection?.(new Error("Connection attempt cancelled."));
    const socket = this.socket;
    this.socket = null;
    this.sendWithSocket(socket, { type: "cancel-matchmaking" });
    this.sendWithSocket(socket, { type: "leave-room" });
    socket?.close();
    this.setConnectionState("disconnected");
  }

  private isCurrentSocket(socket: WebSocket, generation: number): boolean {
    return generation === this.connectionGeneration && this.socket === socket;
  }

  private notifyListeners(message: OnlineMessage): void {
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch (error) {
        console.error("Online message listener failed.", error);
      }
    }
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.notifyListeners({ type: "connection-status", state });
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
      this.notifyListeners({ type: "connected" });
    } catch {
      if (this.reconnectEnabled) this.scheduleReconnect();
    }
  }


  private send(message: Record<string, unknown>): void {
    this.sendWithSocket(this.socket, message);
  }

  private sendWithSocket(socket: WebSocket | null, message: Record<string, unknown>): void {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }
}
