import type { BattleController } from "./battleController";
import type { OnlineClient } from "../net/onlineClient";
import { clearOnlineResumeToken } from "../app/onlineResumeToken";

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

export function initializeLobbyScreen(options: LobbyScreenOptions) {
  const { client, session, battle, setLobbyStatus } = options;
  const lobby = document.getElementById("online-lobby");
  const joinCode = document.getElementById("join-code");
  const findMatchButton = document.getElementById("find-match");
  const cancelMatchButton = document.getElementById("cancel-match");
  const privateRoomSection = document.getElementById("private-room-section");

  function openLobby(): void {
    if (lobby instanceof HTMLDivElement) lobby.hidden = false;
    setLobbyStatus("Connect to the game server to create or join a room.");
  }

  document.getElementById("online-play")?.addEventListener("click", openLobby);

  findMatchButton?.addEventListener("click", async () => {
    if (!(await session.connect())) return;
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
    if (!(await session.connect())) return;
    client.createRoom();
    setLobbyStatus("Creating room…");
  });

  document.getElementById("join-room")?.addEventListener("click", async () => {
    if (!(await session.connect())) return;
    const code = joinCode instanceof HTMLInputElement ? joinCode.value.trim().toUpperCase() : "";
    if (code.length !== 5) {
      setLobbyStatus("Enter the five-character room code.");
      return;
    }
    client.joinRoom(code);
    setLobbyStatus("Joining room…");
  });

  function hideLobby(): void {
    if (lobby instanceof HTMLDivElement) lobby.hidden = true;
  }

  return { openLobby, hideLobby };
}
