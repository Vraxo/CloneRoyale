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
          document.body.dataset.onlineSide = message.side;
          if (message.publicMatch) {
            if (lobby instanceof HTMLDivElement) lobby.hidden = true;
            setLobbyStatus("Opponent found. Preparing your match…");
          } else {
            if (roomCode) roomCode.textContent = message.code ?? "— — — — —";
            setLobbyStatus("Room " + message.code + " created. Share the code and wait for your opponent.");
          }
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
          if (cancelMatchButton instanceof HTMLButtonElement) cancelMatchButton.hidden = true;
          if (findMatchButton instanceof HTMLButtonElement) findMatchButton.disabled = false;
          if (privateRoomSection instanceof HTMLElement) privateRoomSection.hidden = false;
          if (lobby instanceof HTMLDivElement) lobby.hidden = true;
          setLobbyStatus("Match in progress.");
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
leaveOnlineButton?.addEventListener("click", () => {
  onlineUnsubscribe?.();
  onlineUnsubscribe = null;
  battle.leaveOnline();
  if (lobby instanceof HTMLDivElement) lobby.hidden = true;
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
