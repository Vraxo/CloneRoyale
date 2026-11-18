import { ArenaRenderer } from "./render/arenaRenderer";
import { BattleController } from "./app/battleController";
import { bindBattleInput } from "./app/battleInput";
import { startBattleLoop } from "./app/battleLoop";
import { OnlineClient } from "./net/onlineClient";
import type { AudioEvent } from "./game/types";
import { createMenuAudio } from "./audio/menuAudio";
import { initializeAudioSettings } from "./audio/audioSettings";
import { initializeReplayLibrary } from "./app/replayLibrary";
import { createOnlineSession } from "./app/onlineSession";
import { initializeDeckScreen } from "./app/deckScreen";
import { initializeGuestProfile } from "./app/guestProfile";

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
const menuAudio = createMenuAudio();

initializeDeckScreen(deck => battle.setPlayerDeck(deck), setGameMenuOpen);
document.body.dataset.screen = "home";
document.addEventListener("pointerdown", () => menuAudio.unlock(), true);
document.addEventListener("keydown", () => menuAudio.unlock(), true);
document.addEventListener("click", event => {
  if (document.body.dataset.screen !== "home" || !(event.target instanceof Element)) return;
  const button = event.target.closest("button");
  if (!button) return;
  if (button.id === "menu-play") menuAudio.playLaunch();
  else if (button.id === "menu-settings") menuAudio.playTransition();
  else menuAudio.playButton();
}, true);
menuAudio.startMusic();

initializeAudioSettings(battle, menuAudio);

bindBattleInput(battle);
startBattleLoop(renderer.app, battle);
battle.initialize();
battle.setPaused(true);

const onlineClient = new OnlineClient();
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
const modeDescription = document.getElementById("mode-description");
const menuPlayButton = document.getElementById("menu-play");
const menuOnlineButton = document.getElementById("menu-online");
const menuSettingsButton = document.getElementById("menu-settings");
function setGameScreen(screen: "home" | "battle"): void {
  document.body.dataset.screen = screen;
  if (screen === "battle") {
    menuAudio.stopMusic();
    setGameMenuOpen(false);
  } else {
    menuAudio.startMusic();
  }
}
function startSoloBattle(): void {
  battle.startNewBattle();
  setGameScreen("battle");
}

let opponentName: string | null = null;
const guestProfile = initializeGuestProfile(profile => {
  if (onlineClient.isConnected) onlineClient.setProfile(profile.id, profile.name);
  if (modeDescription) modeDescription.textContent = profile.name
    + (opponentName ? " · vs " + opponentName : battle.isOnline ? " · Online" : " · Live match");
});

function updateOpponentLabel(players: { side: "blue" | "red"; name: string }[]): void {
  const opponent = players.find(player => player.side !== document.body.dataset.onlineSide);
  opponentName = opponent?.name ?? null;
  if (modeDescription) modeDescription.textContent = guestProfile.getProfile().name + (opponentName ? " · vs " + opponentName : " · Online");
}

const BATTLE_EMOTES = [
  { label: "Good game!" },
  { label: "Well played!" },
  { label: "Oops!" },
  { label: "Thanks!" },
  { label: "Wow!" },
  { label: "Good luck!" },
  { label: "Nice!" },
  { label: "Let's go!" },
  { label: "King thumbs up", image: "/emotes/emote-king-thumbs-up.png", audio: "emote-thumbs-up" },
  { label: "King angry", image: "/emotes/emote-king-angry.png", audio: "emote-angry" },
  { label: "King crying", image: "/emotes/emote-king-cry.png", audio: "emote-cry" },
  { label: "King laughing", image: "/emotes/emote-king-laugh.png", audio: "emote-laugh" }
] as const;
const emoteUi = document.getElementById("emote-ui");
if (emoteUi instanceof HTMLElement) emoteUi.hidden = false;
const emoteToggle = document.getElementById("emote-toggle");
const emotePicker = document.getElementById("emote-picker");
const emoteBubbles = {
  blue: document.getElementById("emote-bubble-blue"),
  red: document.getElementById("emote-bubble-red")
};
let emoteHideTimer: ReturnType<typeof setTimeout> | null = null;
function showBattleEmote(side: "blue" | "red", emoteId: number, name: string): void {
  const bubble = emoteBubbles[side];
  const emote = BATTLE_EMOTES[emoteId];
  if (!(bubble instanceof HTMLElement) || !emote) return;
  const nameLabel = bubble.querySelector("span");
  const emoteLabel = bubble.querySelector("strong");
  const emoteImage = bubble.querySelector("img");
  if (nameLabel) nameLabel.textContent = name;
  if (emoteLabel) {
    emoteLabel.textContent = emote.label;
    emoteLabel.hidden = "image" in emote;
  }
  if (emoteImage) {
    if ("image" in emote) {
      emoteImage.src = emote.image;
      emoteImage.alt = emote.label;
      emoteImage.hidden = false;
    } else {
      emoteImage.hidden = true;
      emoteImage.removeAttribute("src");
    }
  }
  if ("audio" in emote) battle.soundEffects.play(emote.audio as AudioEvent);
  bubble.hidden = false;
  if (emoteHideTimer) clearTimeout(emoteHideTimer);
  emoteHideTimer = setTimeout(() => {
    for (const item of Object.values(emoteBubbles)) if (item) item.hidden = true;
    emoteHideTimer = null;
  }, 2600);
}

const onlineSession = createOnlineSession({
  client: onlineClient,
  battle,
  getProfile: guestProfile.getProfile,
  updateOpponentLabel,
  showBattleEmote,
  setGameScreen,
  setReconnectOverlay,
  setLobbyStatus
});

emoteToggle?.addEventListener("click", () => {
  if (!(emotePicker instanceof HTMLElement)) return;
  emotePicker.hidden = !emotePicker.hidden;
  emoteToggle.setAttribute("aria-expanded", String(!emotePicker.hidden));
});
emotePicker?.addEventListener("click", event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>("button[data-emote-id]");
  if (!button) return;
  const emoteId = Number(button.dataset.emoteId);
  if (!Number.isInteger(emoteId) || emoteId < 0 || emoteId >= BATTLE_EMOTES.length) return;
  if (battle.isOnline) {
    onlineClient.sendEmote(emoteId);
  } else {
    showBattleEmote("blue", emoteId, guestProfile.getProfile().name);
  }
  if (emotePicker instanceof HTMLElement) emotePicker.hidden = true;
  emoteToggle?.setAttribute("aria-expanded", "false");
});
document.addEventListener("pointerdown", event => {
  if (!(event.target instanceof Node) || !(emoteUi instanceof HTMLElement) || emoteUi.contains(event.target)) return;
  if (emotePicker instanceof HTMLElement) emotePicker.hidden = true;
  emoteToggle?.setAttribute("aria-expanded", "false");
});

function setLobbyStatus(message: string): void {
  if (lobbyStatus) lobbyStatus.textContent = message;
}

function setReconnectOverlay(visible: boolean, expired = false): void {
  const overlay = document.getElementById("reconnect-overlay");
  const title = document.getElementById("reconnect-title");
  const description = document.getElementById("reconnect-description");
  const spinner = document.getElementById("reconnect-spinner");
  const leave = document.getElementById("reconnect-leave");
  if (!(overlay instanceof HTMLDivElement)) return;
  overlay.hidden = !visible;
  if (title) title.textContent = expired ? "Match unavailable" : "Reconnecting…";
  if (description) description.textContent = expired
    ? "The server could not restore your previous match. You can return to the main menu."
    : "Your match is being kept while we restore the connection. Please keep this screen open.";
  if (spinner instanceof HTMLElement) spinner.hidden = expired;
  if (leave instanceof HTMLButtonElement) leave.hidden = !expired;
}
document.getElementById("reconnect-leave")?.addEventListener("click", () => {
  if (battle.isOnline) leaveOnlineMatch();
  setGameScreen("home");
});

function openLobby(): void {
  if (lobby instanceof HTMLDivElement) lobby.hidden = false;
  setLobbyStatus("Connect to the game server to create or join a room.");
}


onlineButton?.addEventListener("click", openLobby);
menuPlayButton?.addEventListener("click", startSoloBattle);
menuOnlineButton?.addEventListener("click", openLobby);
menuSettingsButton?.addEventListener("click", () => setGameMenuOpen(true));
findMatchButton?.addEventListener("click", async () => {
  if (!(await onlineSession.connect())) return;
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
    onlineSession.unsubscribe();
    onlineClient.leave();
    if (cancelMatchButton instanceof HTMLButtonElement) cancelMatchButton.hidden = true;
    if (findMatchButton instanceof HTMLButtonElement) findMatchButton.disabled = false;
    if (privateRoomSection instanceof HTMLElement) privateRoomSection.hidden = false;
  }
  if (lobby instanceof HTMLDivElement) lobby.hidden = true;
});
lobby?.addEventListener("click", event => {
  if (event.target === lobby) closeLobbyButton?.click();
});
createRoomButton?.addEventListener("click", async () => {
  if (!(await onlineSession.connect())) return;
  onlineClient.createRoom();
  setLobbyStatus("Creating room…");
});
joinRoomButton?.addEventListener("click", async () => {
  if (!(await onlineSession.connect())) return;
  const code = joinCode instanceof HTMLInputElement ? joinCode.value.trim().toUpperCase() : "";
  if (code.length !== 5) { setLobbyStatus("Enter the five-character room code."); return; }
  onlineClient.joinRoom(code);
  setLobbyStatus("Joining room…");
});
function leaveOnlineMatch(): void {
  setReconnectOverlay(false);
  if (emoteUi instanceof HTMLElement) emoteUi.hidden = false;
  if (emotePicker instanceof HTMLElement) emotePicker.hidden = true;
  emoteToggle?.setAttribute("aria-expanded", "false");
  for (const item of Object.values(emoteBubbles)) if (item) item.hidden = true;
  if (emoteHideTimer) clearTimeout(emoteHideTimer);
  emoteHideTimer = null;
  onlineSession.unsubscribe();
  battle.leaveOnline();
  opponentName = null;
  if (modeDescription) modeDescription.textContent = guestProfile.getProfile().name + " · Live match";
  if (lobby instanceof HTMLDivElement) lobby.hidden = true;
  if (playAgainButton instanceof HTMLButtonElement) {
    playAgainButton.disabled = false;
    playAgainButton.textContent = "Play again";
  }
}
leaveOnlineButton?.addEventListener("click", leaveOnlineMatch);
leaveResultButton?.addEventListener("click", leaveOnlineMatch);
const returnMainMenuButton = document.getElementById("return-main-menu");
returnMainMenuButton?.addEventListener("click", () => {
  if (battle.isOnline) {
    leaveOnlineMatch();
  } else {
    battle.setPaused(true);
  }
  setGameScreen("home");
});
initializeReplayLibrary({
  battle,
  api: path => (import.meta.env.VITE_MULTIPLAYER_SERVER_URL ?? "").replace(/\/$/, "") + path,
  setGameScreen,
  setGameMenuOpen,
  replayId: parameters.get("replay")
});
playAgainButton?.addEventListener("click", () => {
  if (battle.isOnline) {
    onlineClient.requestRematch();
    playAgainButton.setAttribute("disabled", "true");
    playAgainButton.textContent = "Waiting for opponent…";
    setLobbyStatus("Rematch requested. Waiting for your opponent…");
  } else {
    startSoloBattle();
  }
});

const gameMenuToggle = document.getElementById("game-menu-toggle");
const closeGameMenuButton = document.getElementById("close-game-menu");
function setGameMenuOpen(open: boolean): void {
  document.body.dataset.controlsOpen = open ? "true" : "false";
  gameMenuToggle?.setAttribute("aria-expanded", String(open));
}
closeGameMenuButton?.addEventListener("click", () => setGameMenuOpen(false));
gameMenuToggle?.addEventListener("click", () => {
  const open = document.body.dataset.controlsOpen !== "true";
  menuAudio.playTransition();
  setGameMenuOpen(open);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") setGameMenuOpen(false);
});
document.addEventListener("pointerdown", event => {
  if (document.body.dataset.controlsOpen !== "true" || !(event.target instanceof Element)) return;
  if (event.target.closest(".control-panel, #game-menu-toggle")) return;
  setGameMenuOpen(false);
});
onlineButton?.addEventListener("click", () => setGameMenuOpen(false));

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
