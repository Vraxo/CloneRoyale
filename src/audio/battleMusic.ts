import type { MatchPhase } from "../game/types/GameState";

export interface BattleMusic {
  start(gameTime: number, phase: MatchPhase): void;
  update(gameTime: number, phase: MatchPhase): void;
  setEnabled(enabled: boolean): void;
  setVolume(volume: number): void;
  setPaused(paused: boolean): void;
  setSpeed(speed: number): void;
  seek(gameTime: number, phase: MatchPhase): void;
  stop(): void;
}

interface MusicSegment {
  id: string;
  source: string;
  startTime: number;
}

const REGULATION_SEGMENTS: MusicSegment[] = [
  {
    id: "opening",
    source: "/battle.opus",
    startTime: 0
  },
  {
    id: "final-minute",
    source: "/audio/music/battle-60sec-loop.ogg",
    startTime: 120
  },
  {
    id: "final-thirty-seconds",
    source: "/audio/music/battle-30sec-loop.ogg",
    startTime: 150
  }
];

const OVERTIME_SEGMENT: MusicSegment = {
  id: "overtime",
  source: "/audio/music/battle-60sec-loop.ogg",
  startTime: 180
};

export function createBattleMusic(): BattleMusic {
  const audio = new Audio();
  audio.loop = true;
  audio.preload = "auto";

  const overtimeStart = new Audio("/audio/music/battle-overtime-start.ogg");
  overtimeStart.preload = "auto";

  const baseVolume = 0.35;
  let volume = 1;
  let enabled = true;
  let paused = false;
  let speed = 1;
  let playBlocked = false;
  let pendingPosition: number | null = null;
  let currentSegmentId: string | null = null;
  let currentPhase: MatchPhase = "regulation";

  function segmentFor(gameTime: number, phase: MatchPhase): MusicSegment | null {
    if (phase === "finished") return null;
    if (phase === "overtime" || phase === "tiebreaker") return OVERTIME_SEGMENT;

    let segment = REGULATION_SEGMENTS[0];
    for (const candidate of REGULATION_SEGMENTS) {
      if (gameTime >= candidate.startTime) segment = candidate;
    }

    return segment;
  }

  function setPosition(gameTime: number, segment: MusicSegment): void {
    const elapsed = Math.max(0, gameTime - segment.startTime);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = elapsed % audio.duration;
      pendingPosition = null;
      return;
    }

    pendingPosition = elapsed;
  }

  audio.addEventListener("loadedmetadata", () => {
    if (pendingPosition === null || !Number.isFinite(audio.duration) || audio.duration <= 0) {
      return;
    }

    audio.currentTime = pendingPosition % audio.duration;
    pendingPosition = null;
  });

  function synchronizePlayback(): void {
    audio.playbackRate = speed;
    overtimeStart.playbackRate = speed;
    audio.volume = baseVolume * volume;
    overtimeStart.volume = baseVolume * volume;

    if (!enabled || paused || !audio.src) {
      audio.pause();
      return;
    }

    if (audio.paused && !playBlocked) {
      void audio.play().catch(() => {
        playBlocked = true;
      });
    }
  }

  function synchronizeTrack(
    gameTime: number,
    phase: MatchPhase,
    playTransition: boolean
  ): void {
    const previousPhase = currentPhase;
    const enteredOvertime = playTransition && phase === "overtime" &&
      previousPhase !== "overtime" && previousPhase !== "tiebreaker";
    currentPhase = phase;

    const segment = segmentFor(gameTime, phase);
    if (!segment) {
      stop();
      return;
    }

    if (segment.id !== currentSegmentId) {
      currentSegmentId = segment.id;
      pendingPosition = null;
      audio.pause();
      audio.src = segment.source;
      audio.load();
      setPosition(gameTime, segment);
      playBlocked = false;
    }

    if (enteredOvertime) {
      overtimeStart.currentTime = 0;
      if (enabled && !paused) {
        void overtimeStart.play().catch(() => undefined);
      }
    }

    synchronizePlayback();
  }

  function stop(): void {
    audio.pause();
    audio.currentTime = 0;
    overtimeStart.pause();
    overtimeStart.currentTime = 0;
    currentSegmentId = null;
    pendingPosition = null;
  }

  return {
    start(gameTime: number, phase: MatchPhase): void {
      paused = false;
      playBlocked = false;
      currentSegmentId = null;
      currentPhase = phase;
      synchronizeTrack(gameTime, phase, false);
    },

    update(gameTime: number, phase: MatchPhase): void {
      synchronizeTrack(gameTime, phase, true);
    },

    setVolume(value: number): void {
      volume = Math.max(0, Math.min(1, value));
      synchronizePlayback();
    },

    setEnabled(value: boolean): void {
      enabled = value;
      if (enabled) playBlocked = false;
      synchronizePlayback();
    },

    setPaused(value: boolean): void {
      paused = value;
      if (!paused) playBlocked = false;
      if (paused) overtimeStart.pause();
      synchronizePlayback();
    },

    setSpeed(value: number): void {
      speed = Math.max(0.25, Math.min(8, value));
      playBlocked = false;
      synchronizePlayback();
    },

    seek(gameTime: number, phase: MatchPhase): void {
      synchronizeTrack(gameTime, phase, false);
      const segment = segmentFor(gameTime, phase);
      if (segment) setPosition(gameTime, segment);
      overtimeStart.pause();
      overtimeStart.currentTime = 0;
      synchronizePlayback();
    },

    stop
  };
}
