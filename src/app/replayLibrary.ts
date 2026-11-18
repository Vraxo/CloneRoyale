import type { BattleController } from "./battleController";
import { isBattleReplay, type BattleReplay } from "../game/replay";

type ReplayLibraryOptions = {
  battle: BattleController;
  api: (path: string) => string;
  setGameScreen: (screen: "home" | "battle") => void;
  setGameMenuOpen: (open: boolean) => void;
  replayId: string | null;
};

export function initializeReplayLibrary(options: ReplayLibraryOptions): void {
  const { battle, api, setGameScreen, setGameMenuOpen, replayId } = options;
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
  let replayReturnScreen: "home" | "battle" = "home";

  function readLocalReplays(): BattleReplay[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem("cloneroyale.replays") ?? "[]");
      return Array.isArray(value) ? value.filter(isBattleReplay) : [];
    } catch { return []; }
  }

  function readReplayTokens(): Record<string, string> {
    try {
      const value: unknown = JSON.parse(localStorage.getItem("cloneroyale.replay-share-tokens") ?? "{}");
      return value && typeof value === "object" ? value as Record<string, string> : {};
    } catch { return {}; }
  }

  function formatReplayDuration(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    return String(Math.floor(safe / 60)).padStart(2, "0") + ":" + String(safe % 60).padStart(2, "0");
  }

  function replayResultLabel(winner: string | null): string {
    return winner === "draw" ? "DRAW" : winner === "blue" ? "BLUE VICTORY" : winner === "red" ? "RED VICTORY" : "MATCH";
  }

  function createReplayRow(
    title: string,
    subtitle: string,
    actions: { label: string; run: () => void | Promise<void> }[]
  ): HTMLElement {
    const row = document.createElement("article");
    row.className = "replay-row";
    const details = document.createElement("div");
    details.className = "replay-row-details";
    const heading = document.createElement("strong");
    heading.textContent = title;
    const description = document.createElement("span");
    description.textContent = subtitle;
    details.append(heading, description);
    const controls = document.createElement("div");
    controls.className = "replay-row-actions";
    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button";
      button.textContent = action.label;
      button.addEventListener("click", () => { void action.run(); });
      controls.append(button);
    }
    row.append(details, controls);
    return row;
  }

  async function publishReplay(id: string, token: string): Promise<void> {
    if (replayLibraryStatus) replayLibraryStatus.textContent = "Publishing replay…";
    try {
      const response = await fetch(api("/api/replays/" + encodeURIComponent(id) + "/publish"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shareToken: token })
      });
      const result = await response.json() as { error?: string; url?: string; published?: boolean };
      if (!response.ok || !result.url) throw new Error(result.error ?? "Could not publish replay.");
      const url = new URL(result.url, window.location.origin).toString();
      try { await navigator.clipboard.writeText(url); } catch { window.prompt("Copy this replay link:", url); }
      if (replayLibraryStatus) replayLibraryStatus.textContent = "Replay published. Share this link: " + url;
      const resultStatus = document.getElementById("share-replay-status");
      if (resultStatus) resultStatus.textContent = "Published · link copied to clipboard.";
      if (shareReplayButton instanceof HTMLButtonElement) shareReplayButton.textContent = "✓ LINK COPIED";
      await refreshPublicReplays();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not publish replay.";
      if (replayLibraryStatus) replayLibraryStatus.textContent = message;
      const resultStatus = document.getElementById("share-replay-status");
      if (resultStatus) resultStatus.textContent = message;
    }
  }

  async function watchReplay(replay: unknown): Promise<void> {
    if (!isBattleReplay(replay)) return;
    replayReturnScreen = document.body.dataset.screen === "battle" ? "battle" : "home";
    if (!battle.startReplay(replay)) return;
    if (replayControls instanceof HTMLElement) replayControls.hidden = false;
    if (replayPlayButton) replayPlayButton.textContent = "Ⅱ PAUSE";
    if (replayLibraryPage instanceof HTMLElement) replayLibraryPage.hidden = true;
    setGameScreen("battle");
    setGameMenuOpen(false);
  }

  function renderLocalReplays(): void {
    if (!(localReplayList instanceof HTMLElement)) return;
    localReplayList.replaceChildren();
    const replays = readLocalReplays();
    if (replays.length === 0) {
      const empty = document.createElement("p");
      empty.className = "replay-empty";
      empty.textContent = "No saved replays yet. Finish a solo or multiplayer match to see it here.";
      localReplayList.append(empty);
      return;
    }
    const tokens = readReplayTokens();
    for (const replay of replays) {
      const players = replay.players
        ? replay.players.blue + " vs " + replay.players.red
        : replay.mode === "online" ? "Multiplayer match" : "Solo match";
      const date = new Date(replay.createdAt).toLocaleString();
      const subtitle = players + " · " + replayResultLabel(replay.winner) + " · "
        + formatReplayDuration(replay.durationTicks / 30) + " · " + date;
      const actions: { label: string; run: () => void | Promise<void> }[] = [
        { label: "▶ WATCH", run: () => watchReplay(replay) }
      ];
      const token = tokens[replay.id];
      if (replay.mode === "online" && token) {
        actions.push({ label: "↗ SHARE", run: () => publishReplay(replay.id, token) });
      }
      localReplayList.append(createReplayRow(replayResultLabel(replay.winner), subtitle, actions));
    }
  }

  async function refreshPublicReplays(): Promise<void> {
    if (!(publicReplayList instanceof HTMLElement)) return;
    publicReplayList.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "replay-empty";
    loading.textContent = "Loading public replays…";
    publicReplayList.append(loading);
    try {
      const response = await fetch(api("/api/replays"), { cache: "no-store" });
      if (!response.ok) throw new Error("Replay library is unavailable.");
      const data = await response.json() as {
        replays?: {
          id: string;
          createdAt: number;
          durationSeconds: number;
          winner: string | null;
          players: { blue: string; red: string };
        }[];
      };
      publicReplayList.replaceChildren();
      const replays = data.replays ?? [];
      if (replays.length === 0) {
        const empty = document.createElement("p");
        empty.className = "replay-empty";
        empty.textContent = "No public matches yet. Completed PvP matches appear here automatically.";
        publicReplayList.append(empty);
        return;
      }
      for (const replay of replays) {
        const subtitle = replay.players.blue + " vs " + replay.players.red + " · "
          + replayResultLabel(replay.winner) + " · " + formatReplayDuration(replay.durationSeconds)
          + " · " + new Date(replay.createdAt).toLocaleString();
        publicReplayList.append(createReplayRow(replayResultLabel(replay.winner), subtitle, [
          {
            label: "▶ WATCH",
            run: async () => {
              const result = await fetch(api("/api/replays/" + encodeURIComponent(replay.id)));
              if (!result.ok) throw new Error("Replay not found.");
              const payload = await result.json() as { replay?: BattleReplay };
              await watchReplay(payload.replay);
            }
          },
          {
            label: "↗ COPY LINK",
            run: async () => {
              const url = new URL("/?replay=" + encodeURIComponent(replay.id), window.location.origin).toString();
              try {
                await navigator.clipboard.writeText(url);
                if (replayLibraryStatus) replayLibraryStatus.textContent = "Replay link copied: " + url;
              } catch {
                window.prompt("Copy this replay link:", url);
              }
            }
          }
        ]));
      }
    } catch (error) {
      publicReplayList.replaceChildren();
      const empty = document.createElement("p");
      empty.className = "replay-empty";
      empty.textContent = error instanceof Error ? error.message : "Could not load public replays.";
      publicReplayList.append(empty);
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
    if (replayLibraryPage instanceof HTMLElement) replayLibraryPage.hidden = true;
    document.body.dataset.screen = "home";
  }

  watchReplayButton?.addEventListener("click", () => {
    if (battle.completedReplay) void watchReplay(battle.completedReplay);
  });
  shareReplayButton?.addEventListener("click", () => {
    const replay = battle.completedReplay;
    const token = battle.completedReplayShareToken;
    if (replay && token) void publishReplay(replay.id, token);
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
    void fetch(api("/api/replays/" + replayId)).then(async response => {
      if (!response.ok) throw new Error("This replay link is invalid or no longer available.");
      const payload = await response.json() as { replay?: BattleReplay };
      await watchReplay(payload.replay);
    }).catch(error => {
      if (replayLibraryStatus) {
        replayLibraryStatus.textContent = error instanceof Error ? error.message : "Could not load replay.";
      }
      openReplayLibrary();
    });
  }
}
