import { ArenaRenderer } from "./battle/render/arenaRenderer";
import { BattleController } from "./app/battleController";
import { bindBattleInput } from "./battle/battleInput";
import { startBattleLoop } from "./battle/battleLoop";
import { OnlineClient } from "./multiplayer/onlineClient";
import { createMenuAudio } from "./audio/menuAudio";
import { initializeAudioSettings } from "./audio/audioSettings";
import { initializeReplayLibrary } from "./replays/replayLibrary";
import { createOnlineSession } from "./multiplayer/onlineSession";
import { initializeDeckScreen } from "./decks/deckScreen";
import { initializeGuestProfile } from "./profile/guestProfile";
import { initializeAccountPanel } from "./accounts/accountPanel";
import { initializeBattleEmotes } from "./battle/battleEmotes";
import { createGameNavigation } from "./app/gameNavigation";
import { initializeLobbyScreen } from "./multiplayer/lobbyScreen";
import { initializeGameMenu } from "./app/gameMenu";
import { initializeMatchLifecycle } from "./multiplayer/matchLifecycle";
import { initializeMatchResults } from "./multiplayer/matchResults";
import { initializeDeveloperMode } from "./app/developerMode";

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
const modeDescription = document.getElementById("mode-description");
let opponentName: string | null = null;
initializeAccountPanel();
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

let matchLifecycle: ReturnType<typeof initializeMatchLifecycle> | null = null;
function setReconnectOverlay(visible: boolean, expired = false): void {
  matchLifecycle?.setReconnectOverlay(visible, expired);
}

lobbyScreen = initializeLobbyScreen({
  client: onlineClient,
  session: onlineSession,
  battle,
  setLobbyStatus
});

matchLifecycle = initializeMatchLifecycle({
  battle,
  unsubscribe: onlineSession.unsubscribe,
  resetEmotes: () => battleEmotes?.reset(),
  getPlayerName: () => guestProfile.getProfile().name,
  resetOpponent: () => { opponentName = null; },
  hideLobby: () => lobbyScreen?.hideLobby(),
  setGameScreen
});
initializeReplayLibrary({
  battle,
  api: path => (import.meta.env.VITE_MULTIPLAYER_SERVER_URL ?? "").replace(/\/$/, "") + path,
  setGameScreen,
  setGameMenuOpen,
  replayId: parameters.get("replay")
});
initializeMatchResults({ battle, client: onlineClient, startSoloBattle, setLobbyStatus });

onlineButton?.addEventListener("click", () => setGameMenuOpen(false));

initializeDeveloperMode(battle, developerMode);
