import { ArenaRenderer } from "./render/arenaRenderer";
import { BattleController } from "./app/battleController";
import { bindBattleInput } from "./app/battleInput";
import { startBattleLoop } from "./app/battleLoop";
import { OnlineClient } from "./net/onlineClient";
import { createMenuAudio } from "./audio/menuAudio";
import { initializeAudioSettings } from "./audio/audioSettings";
import { initializeReplayLibrary } from "./app/replayLibrary";
import { createOnlineSession } from "./app/onlineSession";
import { initializeDeckScreen } from "./app/deckScreen";
import { initializeGuestProfile } from "./app/guestProfile";
import { initializeBattleEmotes } from "./app/battleEmotes";
import { createGameNavigation } from "./app/gameNavigation";
import { initializeLobbyScreen } from "./app/lobbyScreen";
import { initializeGameMenu } from "./app/gameMenu";

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
const setGameMenuOpen = initializeGameMenu(menuAudio);
let lobbyScreen: ReturnType<typeof initializeLobbyScreen> | null = null;
function openLobby(): void { lobbyScreen?.openLobby(); }
const navigation = createGameNavigation({ battle, menuAudio, setGameMenuOpen, openLobby });
const { setGameScreen, startSoloBattle } = navigation;

initializeDeckScreen(deck => battle.setPlayerDeck(deck), setGameMenuOpen);
document.addEventListener("pointerdown", () => menuAudio.unlock(), true);
document.addEventListener("keydown", () => menuAudio.unlock(), true);
menuAudio.startMusic();

initializeAudioSettings(battle, menuAudio);

bindBattleInput(battle);
startBattleLoop(renderer.app, battle);
battle.initialize();
battle.setPaused(true);

const onlineClient = new OnlineClient();
const lobbyStatus = document.getElementById("online-status");
const onlineButton = document.getElementById("online-play");
const leaveOnlineButton = document.getElementById("leave-online");
const playAgainButton = document.getElementById("play-again");
const leaveResultButton = document.getElementById("leave-result");
const modeDescription = document.getElementById("mode-description");
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

let battleEmotes: ReturnType<typeof initializeBattleEmotes> | null = null;
function showBattleEmote(side: "blue" | "red", emoteId: number, name: string): void {
  battleEmotes?.showBattleEmote(side, emoteId, name);
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

battleEmotes = initializeBattleEmotes({
  battle,
  getPlayerName: () => guestProfile.getProfile().name,
  sendOnlineEmote: emoteId => onlineSession.sendEmote(emoteId)
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

lobbyScreen = initializeLobbyScreen({
  client: onlineClient,
  session: onlineSession,
  battle,
  setLobbyStatus
});

function leaveOnlineMatch(): void {
  setReconnectOverlay(false);
  battleEmotes?.reset();
  onlineSession.unsubscribe();
  battle.leaveOnline();
  opponentName = null;
  if (modeDescription) modeDescription.textContent = guestProfile.getProfile().name + " · Live match";
  lobbyScreen?.hideLobby();
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
