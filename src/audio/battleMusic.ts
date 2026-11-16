export interface BattleMusic {
  start(gameTime: number): void;
  setEnabled(enabled: boolean): void;
  setVolume(volume: number): void;
  setPaused(paused: boolean): void;
  setSpeed(speed: number): void;
  seek(gameTime: number): void;
  stop(): void;
}

export function createBattleMusic(): BattleMusic {
  const audio = new Audio("/battle.opus");
  audio.loop = true;
  audio.preload = "auto";
  const baseVolume = 0.35;
  let volume = 1;
  audio.volume = baseVolume;

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

    setVolume(value: number): void {
      volume = Math.max(0, Math.min(1, value));
      audio.volume = baseVolume * volume;
      if (volume > 0) playBlocked = false;
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

    seek(gameTime: number): void {
      setPosition(gameTime);
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
