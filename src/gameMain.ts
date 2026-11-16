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
const profileButton = document.getElementById("profile-button");
const profileNameLabel = document.getElementById("profile-name");
const profileAvatar = document.getElementById("profile-avatar");
const profilePanel = document.getElementById("profile-panel");
const profileNameInput = document.getElementById("profile-name-input");
const profileError = document.getElementById("profile-error");
const saveProfileButton = document.getElementById("save-profile");
const closeProfileButton = document.getElementById("close-profile");
const modeDescription = document.getElementById("mode-description");

type GuestProfile = { id: string; name: string };
function createGuestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}
function loadGuestProfile(): GuestProfile {
  try {
    const stored = JSON.parse(localStorage.getItem("cloneroyale.profile") ?? "null") as Partial<GuestProfile> | null;
    if (stored && typeof stored.id === "string" && /^[a-f0-9-]{36}$/i.test(stored.id)
      && typeof stored.name === "string" && stored.name.trim()) {
      return { id: stored.id, name: stored.name.trim().slice(0, 16) };
    }
  } catch { /* Replace invalid local profile data. */ }
  const profile = { id: createGuestId(), name: "Guest" };
  localStorage.setItem("cloneroyale.profile", JSON.stringify(profile));
  return profile;
}
let guestProfile = loadGuestProfile();
let opponentName: string | null = null;
function renderProfile(): void {
  if (profileNameLabel) profileNameLabel.textContent = guestProfile.name;
  if (profileAvatar) profileAvatar.textContent = guestProfile.name.charAt(0).toUpperCase();
  if (profileButton) profileButton.setAttribute("aria-label", "Player profile: " + guestProfile.name);
  if (profileNameInput instanceof HTMLInputElement) profileNameInput.value = guestProfile.name;
}
function updateOpponentLabel(players: { side: "blue" | "red"; name: string }[]): void {
  const opponent = players.find(player => player.side !== document.body.dataset.onlineSide);
  opponentName = opponent?.name ?? null;
  if (modeDescription) modeDescription.textContent = guestProfile.name + (opponentName ? " · vs " + opponentName : " · Online");
}
renderProfile();

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
          onlineClient.setProfile(guestProfile.id, guestProfile.name);
          if (message.players) updateOpponentLabel(message.players);
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
          updateOpponentLabel(message.players);
          const opponent = message.players.find(player => player.side !== document.body.dataset.onlineSide);
          setLobbyStatus(opponent ? "Room " + message.code + " · " + opponent.name + " joined." : "Room " + message.code + " created. Share the code and wait for your opponent.");
        } else if (message.type === "players-updated") {
          updateOpponentLabel(message.players);
        } else if (message.type === "match-start") {
          if (message.players) updateOpponentLabel(message.players);
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
          if (message.players) updateOpponentLabel(message.players);
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
      });
      onlineClient.setProfile(guestProfile.id, guestProfile.name);
      onlineClient.resume();
    }
    return true;
  } catch (error) {
    setLobbyStatus(error instanceof Error ? error.message : "Could not connect to the game server.");
    return false;
  }
}

profileButton?.addEventListener("click", () => {
  renderProfile();
  if (profilePanel instanceof HTMLDivElement) profilePanel.hidden = false;
  if (profileNameInput instanceof HTMLInputElement) {
    profileNameInput.focus();
    profileNameInput.select();
  }
});
function closeProfile(): void {
  if (profilePanel instanceof HTMLDivElement) profilePanel.hidden = true;
  if (profileError) profileError.textContent = "";
}
closeProfileButton?.addEventListener("click", closeProfile);
profilePanel?.addEventListener("click", event => {
  if (event.target === profilePanel) closeProfile();
});
saveProfileButton?.addEventListener("click", () => {
  const name = profileNameInput instanceof HTMLInputElement ? profileNameInput.value.trim() : "";
  if (!name) {
    if (profileError) profileError.textContent = "Enter a display name.";
    return;
  }
  guestProfile = { ...guestProfile, name: name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 16) };
  localStorage.setItem("cloneroyale.profile", JSON.stringify(guestProfile));
  renderProfile();
  if (onlineClient.isConnected) onlineClient.setProfile(guestProfile.id, guestProfile.name);
  if (modeDescription) modeDescription.textContent = guestProfile.name + (opponentName ? " · vs " + opponentName : battle.isOnline ? " · Online" : " · Live match");
  closeProfile();
});
profileNameInput?.addEventListener("keydown", event => {
  if (event.key === "Enter") saveProfileButton?.click();
  if (event.key === "Escape") closeProfile();
});

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
  opponentName = null;
  if (modeDescription) modeDescription.textContent = guestProfile.name + " · Live match";
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
