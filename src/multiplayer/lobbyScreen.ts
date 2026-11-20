import type { BattleController } from "../app/battleController";
import type { OnlineClient } from "./onlineClient";
import { clearOnlineResumeToken } from "./onlineResumeToken";

type LobbySession = {
  connect: () => Promise<boolean>;
  unsubscribe: () => void;
};

type LobbyScreenOptions = {
  client: OnlineClient;
  session: LobbySession;
  battle: BattleController;
  setLobbyStatus: (message: string) => void;
};

type MatchmakingStatus = {
  connectedClients: number;
  queuedPlayers: number;
  activePublicMatches: number;
};

const STATUS_REFRESH_MS = 5000;

function matchmakingStatusUrl(): string {
  const configuredUrl = import.meta.env.VITE_MULTIPLAYER_SERVER_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "") + "/matchmaking-status";

  const protocol = window.location.protocol;
  const port = import.meta.env.DEV ? ":3001" : window.location.port ? ":" + window.location.port : "";
  return protocol + "//" + window.location.hostname + port + "/matchmaking-status";
}

function isMatchmakingStatus(value: unknown): value is MatchmakingStatus {
  if (typeof value !== "object" || value === null) return false;
  const status = value as Record<string, unknown>;
  return ["connectedClients", "queuedPlayers", "activePublicMatches"].every(key =>
    Number.isInteger(status[key]) && (status[key] as number) >= 0
  );
}

export function initializeLobbyScreen(options: LobbyScreenOptions) {
  const { client, session, battle, setLobbyStatus } = options;
  const lobby = document.getElementById("online-lobby");
  const joinCode = document.getElementById("join-code");
  const findMatchButton = document.getElementById("find-match");
  const cancelMatchButton = document.getElementById("cancel-match");
  const privateRoomSection = document.getElementById("private-room-section");
  const connectedCount = document.getElementById("presence-connected");
  const queuedCount = document.getElementById("presence-queued");
  const activeMatchCount = document.getElementById("presence-matches");
  const presenceNote = document.getElementById("presence-note");
  const presenceUpdated = document.getElementById("presence-updated");
  const chatMessages = document.getElementById("global-chat-messages");
  const chatForm = document.getElementById("global-chat-form");
  const chatInput = document.getElementById("global-chat-input");
  const chatStatus = document.getElementById("global-chat-status");
  const chatHistory: Array<{ id: string; name: string; text: string; timestamp: number }> = [];
  const unsubscribeChat = client.subscribe(message => {
    if (message.type === "global-chat-history") {
      chatHistory.splice(0, chatHistory.length, ...message.messages);
      renderChat();
    } else if (message.type === "global-chat-message") {
      chatHistory.push(message.message);
      if (chatHistory.length > 50) chatHistory.shift();
      renderChat();
    } else if (message.type === "connection-status" && chatStatus) {
      chatStatus.textContent = message.state === "connected" ? "CONNECTED" : message.state.toUpperCase();
      chatStatus.dataset.state = message.state;
    }
  });
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let refreshInProgress = false;

  function renderChat(): void {
    if (!chatMessages) return;
    chatMessages.replaceChildren();
    if (chatHistory.length === 0) {
      const empty = document.createElement("p");
      empty.className = "global-chat-empty";
      empty.textContent = "No messages yet. Say hello to the players online!";
      chatMessages.append(empty);
      return;
    }
    for (const message of chatHistory) {
      const item = document.createElement("article");
      item.className = "global-chat-message";
      const meta = document.createElement("div");
      meta.className = "global-chat-meta";
      const name = document.createElement("strong");
      name.textContent = message.name;
      const time = document.createElement("time");
      time.dateTime = new Date(message.timestamp).toISOString();
      time.textContent = new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const body = document.createElement("p");
      body.textContent = message.text;
      meta.append(name, time);
      item.append(meta, body);
      chatMessages.append(item);
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function connectChat(): Promise<boolean> {
    const connected = await session.connect();
    if (connected) {
      client.requestGlobalChatHistory();
      if (chatStatus) chatStatus.textContent = "CONNECTED";
    } else if (chatStatus) chatStatus.textContent = "OFFLINE";
    return connected;
  }

  function stopStatusRefresh(): void {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
  }

  async function refreshMatchmakingStatus(): Promise<void> {
    if (refreshInProgress || !(lobby instanceof HTMLDivElement) || lobby.hidden) return;
    refreshInProgress = true;
    try {
      const response = await fetch(matchmakingStatusUrl(), { cache: "no-store" });
      if (!response.ok) throw new Error("Status request failed");
      const status: unknown = await response.json();
      if (!isMatchmakingStatus(status)) throw new Error("Invalid status response");
      if (connectedCount) connectedCount.textContent = String(status.connectedClients);
      if (queuedCount) queuedCount.textContent = String(status.queuedPlayers);
      if (activeMatchCount) activeMatchCount.textContent = String(status.activePublicMatches);
      if (presenceNote) {
        presenceNote.textContent = status.connectedClients === 0
          ? "No players are connected yet. Be the first to open the queue."
          : status.connectedClients === 1
            ? "You're the only player online right now. Keep the lobby open and someone can join."
            : status.queuedPlayers > 0
              ? "Players are online and looking for an opponent. Try finding a match."
              : "Players are online, but nobody is searching right now. Start the queue to invite a match.";
      }
      if (presenceUpdated) presenceUpdated.textContent = "LIVE · REFRESHES EVERY 5S";
    } catch {
      if (presenceNote) presenceNote.textContent = "Live player count is temporarily unavailable. You can still try matchmaking.";
      if (presenceUpdated) presenceUpdated.textContent = "STATUS UNAVAILABLE";
    } finally {
      refreshInProgress = false;
    }
  }

  function startStatusRefresh(): void {
    stopStatusRefresh();
    void refreshMatchmakingStatus();
    refreshTimer = setInterval(() => {
      if (!(lobby instanceof HTMLDivElement) || lobby.hidden) {
        stopStatusRefresh();
        return;
      }
      void refreshMatchmakingStatus();
    }, STATUS_REFRESH_MS);
  }

  function openLobby(): void {
    if (lobby instanceof HTMLDivElement) lobby.hidden = false;
    setLobbyStatus("Connecting to the multiplayer lobby…");
    startStatusRefresh();
    void connectChat();
  }

  document.getElementById("online-play")?.addEventListener("click", openLobby);

  chatForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const text = chatInput instanceof HTMLInputElement ? chatInput.value.trim() : "";
    if (!text) return;
    if (!(await connectChat())) return;
    client.sendGlobalChat(text);
    if (chatInput instanceof HTMLInputElement) chatInput.value = "";
  });

  chatInput?.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      chatForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }
  });

  findMatchButton?.addEventListener("click", async () => {
    if (!(await connectChat())) return;
    if (privateRoomSection instanceof HTMLElement) privateRoomSection.hidden = true;
    if (cancelMatchButton instanceof HTMLButtonElement) cancelMatchButton.hidden = false;
    if (findMatchButton instanceof HTMLButtonElement) findMatchButton.disabled = true;
    setLobbyStatus("Searching for an opponent…");
    client.findMatch();
  });

  cancelMatchButton?.addEventListener("click", () => {
    client.cancelMatchmaking();
    if (cancelMatchButton instanceof HTMLButtonElement) cancelMatchButton.hidden = true;
    if (findMatchButton instanceof HTMLButtonElement) findMatchButton.disabled = false;
    if (privateRoomSection instanceof HTMLElement) privateRoomSection.hidden = false;
  });

  document.getElementById("close-lobby")?.addEventListener("click", () => {
    stopStatusRefresh();
    if (!battle.isOnline) {
      session.unsubscribe();
      client.leave();
      clearOnlineResumeToken();
      if (cancelMatchButton instanceof HTMLButtonElement) cancelMatchButton.hidden = true;
      if (findMatchButton instanceof HTMLButtonElement) findMatchButton.disabled = false;
      if (privateRoomSection instanceof HTMLElement) privateRoomSection.hidden = false;
    }
    if (lobby instanceof HTMLDivElement) lobby.hidden = true;
  });

  lobby?.addEventListener("click", event => {
    if (event.target === lobby) document.getElementById("close-lobby")?.dispatchEvent(new MouseEvent("click"));
  });

  document.getElementById("create-room")?.addEventListener("click", async () => {
    if (!(await connectChat())) return;
    client.createRoom();
    setLobbyStatus("Creating room…");
  });

  document.getElementById("join-room")?.addEventListener("click", async () => {
    if (!(await connectChat())) return;
    const code = joinCode instanceof HTMLInputElement ? joinCode.value.trim().toUpperCase() : "";
    if (code.length !== 5) {
      setLobbyStatus("Enter the five-character room code.");
      return;
    }
    client.joinRoom(code);
    setLobbyStatus("Joining room…");
  });

  function hideLobby(): void {
    stopStatusRefresh();
    if (lobby instanceof HTMLDivElement) lobby.hidden = true;
  }

  return { openLobby, hideLobby, unsubscribeChat };
}
