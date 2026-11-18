import type { BattleController } from "./battleController";
import type { BattleReplay } from "../game/replay";
import {
  readSavedBattleReplays,
  readReplayShareTokens
} from "../game/replayStorage";
import { createReplayLibraryApi } from "./replayLibraryApi";
import { copyReplayLink, createPublicReplayLink } from "./replaySharing";
import {
  createReplayEmptyState,
  createReplayRow,
  describeLocalReplay,
  describePublicReplay,
  replayResultLabel
} from "./replayLibraryView";

type ReplayLibraryOptions = {
  battle: BattleController;
  api: (path: string) => string;
  setGameScreen: (screen: "home" | "battle") => void;
  setGameMenuOpen: (open: boolean) => void;
  replayId: string | null;
};

export function initializeReplayLibrary(options: ReplayLibraryOptions): void {
  const { battle, api, setGameScreen, setGameMenuOpen, replayId } = options;
  const replayApi = createReplayLibraryApi(api);
  const watchReplayButton = document.getElementById("watch-replay");
  const shareReplayButton = document.getElementById("share-replay");
  const replayControls = document.getElementById("replay-controls");
  const replayPlayButton = document.getElementById("replay-play");
  const replayExitButton = document.getElementById("replay-exit");
  const replayTimeline = document.getElementById("replay-timeline");
  const replaySpeed = document.getElementById("replay-speed");
  const replayLibraryPage = document.getElementById("replays-page");
  const localReplayList = document.getElementById("local-replay-list");
  const publicReplayList = document.getElementById("public-replay-list");
  const replayLibraryStatus = document.getElementById("replay-library-status");
  const shareReplayStatus = document.getElementById("share-replay-status");
  let replayReturnScreen: "home" | "battle" = "home";
  let publicRefreshVersion = 0;

  function showStatus(message: string): void {
    if (replayLibraryStatus) replayLibraryStatus.textContent = message;
  }

  function reportActionError(error: unknown): void {
    showStatus(error instanceof Error ? error.message : "The replay action failed.");
  }

  function watchReplay(replay: unknown): void {
    if (!battle.startReplay(replay)) return;
    replayReturnScreen = document.body.dataset.screen === "battle" ? "battle" : "home";
    if (replayControls instanceof HTMLElement) replayControls.hidden = false;
    if (replayPlayButton) replayPlayButton.textContent = "Ⅱ PAUSE";
    if (replayLibraryPage instanceof HTMLElement) replayLibraryPage.hidden = true;
    setGameScreen("battle");
    setGameMenuOpen(false);
  }

  function renderLocalReplays(): void {
    if (!(localReplayList instanceof HTMLElement)) return;
    localReplayList.replaceChildren();
    const replays = readSavedBattleReplays();
    if (replays.length === 0) {
      localReplayList.append(createReplayEmptyState(
        "No saved replays yet. Finish a solo or multiplayer match to see it here."
      ));
      return;
    }

    const tokens = readReplayShareTokens();
    for (const replay of replays) {
      const actions = [{
        label: "▶ WATCH",
        run: () => watchReplay(replay)
      }];
      const token = tokens[replay.id];
      if (replay.mode === "online" && token) {
        actions.push({
          label: "↗ SHARE",
          run: () => publishReplay(replay.id, token)
        });
      }
      localReplayList.append(createReplayRow(
        replayResultLabel(replay.winner),
        describeLocalReplay(replay),
        actions,
        reportActionError
      ));
    }
  }

  async function publishReplay(id: string, token: string): Promise<void> {
    showStatus("Publishing replay…");
    const url = await replayApi.publishReplay(id, token);
    await copyReplayLink(url);
    showStatus("Replay published. Share this link: " + url);
    if (shareReplayStatus) shareReplayStatus.textContent = "Published · link copied to clipboard.";
    if (shareReplayButton instanceof HTMLButtonElement) shareReplayButton.textContent = "✓ LINK COPIED";
    await refreshPublicReplays();
  }

  async function refreshPublicReplays(): Promise<void> {
    if (!(publicReplayList instanceof HTMLElement)) return;
    const requestVersion = ++publicRefreshVersion;
    publicReplayList.replaceChildren(createReplayEmptyState("Loading public replays…"));

    try {
      const replays = await replayApi.listPublicReplays();
      if (requestVersion !== publicRefreshVersion) return;
      publicReplayList.replaceChildren();
      if (replays.length === 0) {
        publicReplayList.append(createReplayEmptyState(
          "No public matches yet. Completed PvP matches appear here automatically."
        ));
        return;
      }

      for (const replay of replays) {
        const actions = [
          {
            label: "▶ WATCH",
            run: async () => watchReplay(await replayApi.getPublicReplay(replay.id))
          },
          {
            label: "↗ COPY LINK",
            run: async () => {
              const url = createPublicReplayLink(replay.id);
              await copyReplayLink(url);
              showStatus("Replay link copied: " + url);
            }
          }
        ];
        publicReplayList.append(createReplayRow(
          replayResultLabel(replay.winner),
          describePublicReplay(replay),
          actions,
          reportActionError
        ));
      }
    } catch (error) {
      if (requestVersion !== publicRefreshVersion) return;
      publicReplayList.replaceChildren(createReplayEmptyState(
        error instanceof Error ? error.message : "Could not load public replays."
      ));
    }
  }

  function openReplayLibrary(): void {
    renderLocalReplays();
    if (replayLibraryPage instanceof HTMLElement) replayLibraryPage.hidden = false;
    document.body.dataset.screen = "replays";
    setGameMenuOpen(false);
    void refreshPublicReplays();
  }

  function closeReplayLibrary(): void {
    publicRefreshVersion++;
    if (replayLibraryPage instanceof HTMLElement) replayLibraryPage.hidden = true;
    document.body.dataset.screen = "home";
  }

  watchReplayButton?.addEventListener("click", () => {
    if (battle.completedReplay) watchReplay(battle.completedReplay);
  });
  shareReplayButton?.addEventListener("click", () => {
    const replay = battle.completedReplay;
    const token = battle.completedReplayShareToken;
    if (replay && token) {
      void publishReplay(replay.id, token).catch(reportActionError);
    }
  });
  replayPlayButton?.addEventListener("click", () => {
    battle.setPaused(!battle.isPaused);
    replayPlayButton.textContent = battle.isPaused ? "▶ PLAY" : "Ⅱ PAUSE";
  });
  replayExitButton?.addEventListener("click", () => {
    battle.exitReplay();
    if (replayControls instanceof HTMLElement) replayControls.hidden = true;
    document.body.dataset.replaying = "false";
    setGameScreen(replayReturnScreen);
  });
  replayTimeline?.addEventListener("input", () => {
    if (replayTimeline instanceof HTMLInputElement) battle.seekReplay(Number(replayTimeline.value));
  });
  replaySpeed?.addEventListener("change", () => {
    if (replaySpeed instanceof HTMLSelectElement) battle.setSpeed(Number(replaySpeed.value));
  });
  document.getElementById("menu-replays")?.addEventListener("click", openReplayLibrary);
  document.getElementById("replays-back")?.addEventListener("click", closeReplayLibrary);
  document.getElementById("replays-done")?.addEventListener("click", closeReplayLibrary);
  document.getElementById("replays-refresh")?.addEventListener("click", () => {
    renderLocalReplays();
    void refreshPublicReplays();
  });

  if (replayId && /^[a-f0-9]{32}$/.test(replayId)) {
    void replayApi.getPublicReplay(replayId).then(watchReplay).catch(error => {
      showStatus(error instanceof Error ? error.message : "Could not load replay.");
      openReplayLibrary();
    });
  }
}
