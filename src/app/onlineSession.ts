import type { BattleController } from "./battleController";
import type { OnlineClient, OnlineMessage } from "../net/onlineClient";
import type { Side } from "../game/types";

type OnlineProfile = { id: string; name: string };
type OnlinePlayer = { side: Side; name: string };

type OnlineSessionOptions = {
  client: OnlineClient;
  battle: BattleController;
  getProfile: () => OnlineProfile;
  updateOpponentLabel: (players: OnlinePlayer[]) => void;
  showBattleEmote: (side: Side, emoteId: number, name: string) => void;
  setGameScreen: (screen: "home" | "battle") => void;
  setReconnectOverlay: (visible: boolean, expired?: boolean) => void;
  setLobbyStatus: (message: string) => void;
};

export function createOnlineSession(options: OnlineSessionOptions) {
  const { client, battle, getProfile, updateOpponentLabel, showBattleEmote, setGameScreen, setReconnectOverlay, setLobbyStatus } = options;
  const lobby = document.getElementById("online-lobby");
  const roomCode = document.getElementById("room-code");
  const cancelMatchButton = document.getElementById("cancel-match");
  const findMatchButton = document.getElementById("find-match");
  const privateRoomSection = document.getElementById("private-room-section");
  const playAgainButton = document.getElementById("play-again");
  const emoteUi = document.getElementById("emote-ui");
  let messageUnsubscribe: (() => void) | null = null;
  let connectionStatusUnsubscribe: (() => void) | null = null;

  function renderConnectionStatus(state: "connecting" | "connected" | "reconnecting" | "disconnected"): void {
    const status = document.getElementById("network-status");
    if (!status) return;
    const labels = {
      connecting: "CONNECTING TO SERVER",
      connected: "SERVER CONNECTED",
      reconnecting: "RECONNECTING TO SERVER",
      disconnected: "SERVER DISCONNECTED"
    } as const;
    const visibleState = navigator.onLine ? state : "offline";
    status.dataset.state = visibleState;
    status.textContent = visibleState === "offline" ? "NO INTERNET · SOLO PLAY AVAILABLE" : labels[state];
    status.hidden = false;
  }

  function handleMessage(message: OnlineMessage): void {
    if (message.type === "assigned") {
      if (message.resumeToken) localStorage.setItem("cloneroyale.resume-token", message.resumeToken);
      document.body.dataset.onlineSide = message.side;
      if (message.publicMatch) {
        if (lobby instanceof HTMLDivElement) lobby.hidden = true;
        setLobbyStatus("Opponent found. Preparing your match…");
      } else {
        if (roomCode) roomCode.textContent = message.code ?? "— — — — —";
        setLobbyStatus("Room " + message.code + " created. Share the code and wait for your opponent.");
      }
    } else if (message.type === "resumed") {
      setReconnectOverlay(false);
      const profile = getProfile();
      localStorage.setItem("cloneroyale.resume-token", message.resumeToken);
      document.body.dataset.onlineSide = message.side;
      client.setProfile(profile.id, profile.name);
      if (message.players) updateOpponentLabel(message.players);
      if (message.state) {
        setGameScreen("battle");
        if (emoteUi instanceof HTMLElement) emoteUi.hidden = false;
        battle.activateOnline(message.side, message.state, client);
        if (playAgainButton instanceof HTMLButtonElement) {
          playAgainButton.disabled = false;
          playAgainButton.textContent = "Rematch";
        }
        if (lobby instanceof HTMLDivElement) lobby.hidden = true;
        setLobbyStatus("Connection restored. Back in the match.");
      } else setLobbyStatus("Connection restored. Waiting for your opponent…");
    } else if (message.type === "resume-failed") {
      localStorage.removeItem("cloneroyale.resume-token");
      setLobbyStatus("Your previous match is no longer available. You can find a new match.");
      if (battle.isOnline) setReconnectOverlay(true, true);
    } else if (message.type === "connection-lost") {
      if (battle.isOnline) {
        setReconnectOverlay(true);
        battle.setOnlineNotice("Connection lost. Reconnecting…");
      }
    } else if (message.type === "opponent-disconnected") {
      battle.setOnlineNotice("Opponent disconnected. Pausing for up to " + message.graceSeconds + " seconds while they reconnect.");
    } else if (message.type === "opponent-reconnected") {
      battle.setOnlineNotice("Opponent reconnected. The battle is resuming.");
    } else if (message.type === "queue-status") {
      const position = message.position ? " · Position " + message.position + " of " + message.waiting : "";
      setLobbyStatus("Searching for an opponent… " + message.waiting + " player" + (message.waiting === 1 ? "" : "s") + " in queue" + position + ".");
    } else if (message.type === "queue-cancelled") {
      setLobbyStatus("Matchmaking cancelled.");
    } else if (message.type === "room") {
      if (roomCode) roomCode.textContent = message.code;
      updateOpponentLabel(message.players);
      const opponent = message.players.find(player => player.side !== document.body.dataset.onlineSide);
      setLobbyStatus(opponent ? "Room " + message.code + " · " + opponent.name + " joined." : "Room " + message.code + " created. Share the code and wait for your opponent.");
    } else if (message.type === "players-updated") {
      updateOpponentLabel(message.players);
    } else if (message.type === "match-start") {
      const shareButton = document.getElementById("share-replay");
      if (shareButton instanceof HTMLButtonElement) { shareButton.hidden = true; shareButton.textContent = "↗ Copy replay link"; }
      const shareStatus = document.getElementById("share-replay-status");
      if (shareStatus) shareStatus.textContent = "";
      setGameScreen("battle");
      if (emoteUi instanceof HTMLElement) emoteUi.hidden = false;
      if (message.players) updateOpponentLabel(message.players);
      const side = document.body.dataset.onlineSide === "red" ? "red" : "blue";
      battle.activateOnline(side, message.state, client);
      if (playAgainButton instanceof HTMLButtonElement) {
        playAgainButton.disabled = false;
        playAgainButton.textContent = "Rematch";
      }
      if (cancelMatchButton instanceof HTMLButtonElement) cancelMatchButton.hidden = true;
      if (findMatchButton instanceof HTMLButtonElement) findMatchButton.disabled = false;
      if (privateRoomSection instanceof HTMLElement) privateRoomSection.hidden = false;
      if (lobby instanceof HTMLDivElement) lobby.hidden = true;
      setLobbyStatus("Match in progress.");
    } else if (message.type === "rematch-status") {
      if (playAgainButton instanceof HTMLButtonElement) {
        playAgainButton.disabled = true;
        playAgainButton.textContent = "Waiting (" + message.ready + "/" + message.total + ")";
      }
      setLobbyStatus("Rematch requested. Waiting for your opponent…");
    } else if (message.type === "rematch-start") {
      const shareButton = document.getElementById("share-replay");
      if (shareButton instanceof HTMLButtonElement) { shareButton.hidden = true; shareButton.textContent = "↗ Share replay"; }
      const shareStatus = document.getElementById("share-replay-status");
      if (shareStatus) shareStatus.textContent = "";
      if (message.players) updateOpponentLabel(message.players);
      if (playAgainButton instanceof HTMLButtonElement) {
        playAgainButton.disabled = false;
        playAgainButton.textContent = "Rematch";
      }
      battle.activateOnline(battle.side, message.state, client);
      setLobbyStatus("Rematch started.");
    } else if (message.type === "emote") {
      showBattleEmote(message.side, message.emoteId, message.name);
    } else if (message.type === "state") {
      battle.applyOnlineState(message.state);
    } else if (message.type === "match-replay") {
      battle.applyOnlineReplay(message.replay, message.shareToken);
      const shareButton = document.getElementById("share-replay");
      if (shareButton instanceof HTMLButtonElement) {
        shareButton.hidden = !battle.completedReplayShareToken;
        shareButton.textContent = "↗ Copy replay link";
      }
    } else if (message.type === "opponent-left") {
      if (battle.isOnline) {
        setLobbyStatus("Opponent left. You can leave this match and find another opponent.");
        battle.setOnlineNotice("Opponent left the match. Leave to find another opponent.");
        if (playAgainButton instanceof HTMLButtonElement && battle.isGameOver) {
          playAgainButton.disabled = true;
          playAgainButton.textContent = "Opponent left";
        }
      }
    } else if (message.type === "action-error" || message.type === "error") {
      setLobbyStatus(message.message);
      battle.setOnlineNotice(message.message);
    }
  }

  async function connect(): Promise<boolean> {
    setLobbyStatus("Connecting to multiplayer server…");
    const connection = client.connect();
    if (!connectionStatusUnsubscribe) {
      connectionStatusUnsubscribe = client.subscribe(message => {
        if (message.type === "connection-status") renderConnectionStatus(message.state);
      });
    }
    try {
      await connection;
      if (!messageUnsubscribe) {
        messageUnsubscribe = client.subscribe(handleMessage);
        const profile = getProfile();
        client.setProfile(profile.id, profile.name);
        client.resume();
      }
      return true;
    } catch (error) {
      setLobbyStatus(error instanceof Error ? error.message : "Could not connect to the game server.");
      return false;
    }
  }

  function unsubscribe(): void {
    messageUnsubscribe?.();
    messageUnsubscribe = null;
  }

  function sendEmote(emoteId: number): void {
    client.sendEmote(emoteId);
  }

  return { connect, unsubscribe, sendEmote };
}
