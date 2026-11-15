export interface BattleMusic {
  start(gameTime: number): void;
  setEnabled(enabled: boolean): void;
  setPaused(paused: boolean): void;
  setSpeed(speed: number): void;
  stop(): void;
}

export function createBattleMusic(): BattleMusic {
  const audio = new Audio("/battle.opus");
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.35;

  let enabled = true;
  let paused = false;
  let speed = 1;
  let playBlocked = false;
  let pendingPosition: number | null = null;

  function setPosition(gameTime: number): void {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = gameTime % audio.duration;
      pendingPosition = null;
      return;
    }

    pendingPosition = gameTime;
  }

  audio.addEventListener("loadedmetadata", () => {
    if (pendingPosition !== null && Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = pendingPosition % audio.duration;
      pendingPosition = null;
    }
  });

  function synchronize(): void {
    audio.playbackRate = speed;

    if (!enabled || paused) {
      audio.pause();
      return;
    }

    if (audio.paused && !playBlocked) {
      void audio.play().catch(() => {
        playBlocked = true;
      });
    }
  }

  return {
    start(gameTime: number): void {
      paused = false;
      playBlocked = false;
      setPosition(gameTime);
      synchronize();
    },

    setEnabled(value: boolean): void {
      enabled = value;
      if (enabled) playBlocked = false;
      synchronize();
    },

    setPaused(value: boolean): void {
      paused = value;
      if (!paused) playBlocked = false;
      synchronize();
    },

    setSpeed(value: number): void {
      speed = value;
      playBlocked = false;
      synchronize();
    },

    stop(): void {
      paused = true;
      playBlocked = false;
      pendingPosition = 0;
      audio.pause();
      audio.currentTime = 0;
    }
  };
}
