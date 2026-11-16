import { ArenaRenderer } from "./render/arenaRenderer";
import { BattleController } from "./app/battleController";
import { bindBattleInput } from "./app/battleInput";
import { startBattleLoop } from "./app/battleLoop";
import { OnlineClient, type OnlineMessage } from "./net/onlineClient";

const parameters = new URLSearchParams(window.location.search);
const developerMode = parameters.get("mode") === "dev";
document.body.dataset.mode = developerMode ? "developer" : "player";

const host = document.getElementById("game");
if (!(host instanceof HTMLDivElement)) {
  throw new Error("Missing required element: #game");
}

await Promise.all([
  document.fonts.load('16px "Supercell Magic"'),
  document.fonts.load('16px "SC CCBackBeat"')
]);

const renderer = new ArenaRenderer();
await renderer.initialize(host);

const battle = new BattleController(renderer, developerMode);
bindBattleInput(battle);
startBattleLoop(renderer.app, battle);
battle.initialize();

const onlineClient = new OnlineClient();
let onlineUnsubscribe: (() => void) | null = null;
const lobby = document.getElementById("online-lobby");
const lobbyStatus = document.getElementById("online-status");
const roomCode = document.getElementById("room-code");
const joinCode = document.getElementById("join-code");
const findMatchButton = document.getElementById("find-match");
const cancelMatchButton = document.getElementById("cancel-match");
const privateRoomSection = document.getElementById("private-room-section");
const createRoomButton = document.getElementById("create-room");
const joinRoomButton = document.getElementById("join-room");
const closeLobbyButton = document.getElementById("close-lobby");
const onlineButton = document.getElementById("online-play");
const leaveOnlineButton = document.getElementById("leave-online");
const playAgainButton = document.getElementById("play-again");
const leaveResultButton = document.getElementById("leave-result");

function setLobbyStatus(message: string): void {
  if (lobbyStatus) lobbyStatus.textContent = message;
}

function openLobby(): void {
  if (lobby instanceof HTMLDivElement) lobby.hidden = false;
  setLobbyStatus("Connect to the game server to create or join a room.");
}

async function connectOnline(): Promise<boolean> {
  setLobbyStatus("Connecting to multiplayer server…");
  try {
    await onlineClient.connect();
    if (!onlineUnsubscribe) {
      onlineUnsubscribe = onlineClient.subscribe((message: OnlineMessage) => {
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
          localStorage.setItem("cloneroyale.resume-token", message.resumeToken);
          document.body.dataset.onlineSide = message.side;
          if (message.state) {
            battle.activateOnline(message.side, message.state, onlineClient);
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
        } else if (message.type === "connection-lost") {
          if (battle.isOnline) battle.setOnlineNotice("Connection lost. Reconnecting…");
        } else if (message.type === "opponent-disconnected") {
          battle.setOnlineNotice("Opponent disconnected. Pausing for up to " + message.graceSeconds + " seconds while they reconnect.");
        } else if (message.type === "opponent-reconnected") {
          battle.setOnlineNotice("Opponent reconnected. The battle is resuming.");
        } else if (message.type === "queue-status") {
          setLobbyStatus("Searching for an opponent…");
        } else if (message.type === "queue-cancelled") {
          setLobbyStatus("Matchmaking cancelled.");
        } else if (message.type === "room") {
          if (roomCode) roomCode.textContent = message.code;
          setLobbyStatus(message.status === "playing" ? "Opponent connected. Starting match…" : "Waiting for another player…");
        } else if (message.type === "match-start") {
          const side = document.body.dataset.onlineSide === "red" ? "red" : "blue";
          battle.activateOnline(side, message.state, onlineClient);
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
          if (playAgainButton instanceof HTMLButtonElement) {
            playAgainButton.disabled = false;
            playAgainButton.textContent = "Rematch";
          }
          battle.activateOnline(battle.side, message.state, onlineClient);
          setLobbyStatus("Rematch started.");
        } else if (message.type === "state") {
          battle.applyOnlineState(message.state);
        } else if (message.type === "opponent-left") {
          if (battle.isOnline) {
            setLobbyStatus("Opponent disconnected. Leave the room to start another match.");
            battle.setOnlineNotice("Opponent disconnected. Leave the match to return to solo play.");
          }
        } else if (message.type === "action-error" || message.type === "error") {
          setLobbyStatus(message.message);
          battle.setOnlineNotice(message.message);
        }
      });
      onlineClient.resume();
    }
    return true;
  } catch (error) {
    setLobbyStatus(error instanceof Error ? error.message : "Could not connect to the game server.");
    return false;
  }
}

onlineButton?.addEventListener("click", openLobby);
findMatchButton?.addEventListener("click", async () => {
  if (!(await connectOnline())) return;
  if (privateRoomSection instanceof HTMLElement) privateRoomSection.hidden = true;
  if (cancelMatchButton instanceof HTMLButtonElement) cancelMatchButton.hidden = false;
  if (findMatchButton instanceof HTMLButtonElement) findMatchButton.disabled = true;
  setLobbyStatus("Searching for an opponent…");
  onlineClient.findMatch();
});
cancelMatchButton?.addEventListener("click", () => {
  onlineClient.cancelMatchmaking();
  if (cancelMatchButton instanceof HTMLButtonElement) cancelMatchButton.hidden = true;
  if (findMatchButton instanceof HTMLButtonElement) findMatchButton.disabled = false;
  if (privateRoomSection instanceof HTMLElement) privateRoomSection.hidden = false;
});
closeLobbyButton?.addEventListener("click", () => {
  if (!battle.isOnline) {
    onlineUnsubscribe?.();
    onlineUnsubscribe = null;
    onlineClient.leave();
    if (cancelMatchButton instanceof HTMLButtonElement) cancelMatchButton.hidden = true;
    if (findMatchButton instanceof HTMLButtonElement) findMatchButton.disabled = false;
    if (privateRoomSection instanceof HTMLElement) privateRoomSection.hidden = false;
  }
  if (lobby instanceof HTMLDivElement) lobby.hidden = true;
});
createRoomButton?.addEventListener("click", async () => {
  if (!(await connectOnline())) return;
  onlineClient.createRoom();
  setLobbyStatus("Creating room…");
});
joinRoomButton?.addEventListener("click", async () => {
  if (!(await connectOnline())) return;
  const code = joinCode instanceof HTMLInputElement ? joinCode.value.trim().toUpperCase() : "";
  if (code.length !== 5) { setLobbyStatus("Enter the five-character room code."); return; }
  onlineClient.joinRoom(code);
  setLobbyStatus("Joining room…");
});
function leaveOnlineMatch(): void {
  onlineUnsubscribe?.();
  onlineUnsubscribe = null;
  battle.leaveOnline();
  if (lobby instanceof HTMLDivElement) lobby.hidden = true;
  if (playAgainButton instanceof HTMLButtonElement) {
    playAgainButton.disabled = false;
    playAgainButton.textContent = "Play again";
  }
}
leaveOnlineButton?.addEventListener("click", leaveOnlineMatch);
leaveResultButton?.addEventListener("click", leaveOnlineMatch);
playAgainButton?.addEventListener("click", () => {
  if (battle.isOnline) {
    onlineClient.requestRematch();
    playAgainButton.setAttribute("disabled", "true");
    playAgainButton.textContent = "Waiting for opponent…";
    setLobbyStatus("Rematch requested. Waiting for your opponent…");
  } else {
    battle.startNewBattle();
  }
});

const modeButton = document.getElementById("mode-toggle");
if (modeButton instanceof HTMLButtonElement) {
  modeButton.textContent = developerMode ? "Player mode" : "Developer tools";
  modeButton.addEventListener("click", () => {
    const nextDeveloperMode = document.body.dataset.mode !== "developer";
    if (nextDeveloperMode) battle.enableDebugTools();
    document.body.dataset.mode = nextDeveloperMode ? "developer" : "player";
    modeButton.textContent = nextDeveloperMode ? "Player mode" : "Developer tools";
  });
}
