import type { AudioEvent } from "../game/types";

export interface SoundEffects {
  play(event: AudioEvent): void;
  setEnabled(enabled: boolean): void;
  setVolume(volume: number): void;
  setSpeed(speed: number): void;
  unlock(): void;
  stopAll(): void;
}

const SOUND_SOURCES: Record<AudioEvent, readonly string[]> = {
  "mini-pekka-deploy": ["/audio/sfx/mini-pekka/mini-pekka-deployment.ogg"],
  "mini-pekka-attack": ["/audio/sfx/mini-pekka/mini-pekka-attack-swing.ogg"],
  "mini-pekka-hit": ["/audio/sfx/mini-pekka/mini-pekka-hit-impact.ogg"],
  "mini-pekka-step": ["/audio/sfx/mini-pekka/mini-pekka-footsteps.ogg"],
  "giant-deploy": ["/audio/sfx/giant/giant-deployment.ogg"],
  "giant-attack": [
    "/audio/sfx/giant/giant-attack-swing-01.ogg",
    "/audio/sfx/giant/giant-attack-swing-02.ogg",
    "/audio/sfx/giant/giant-attack-swing-03.ogg"
  ],
  "giant-hit": ["/audio/sfx/giant/giant-hit-impact.ogg"],
  "giant-step": [
    "/audio/sfx/giant/giant-footstep-01.ogg",
    "/audio/sfx/giant/giant-footstep-02.ogg",
    "/audio/sfx/giant/giant-footstep-03.ogg",
    "/audio/sfx/giant/giant-footstep-04.ogg"
  ],
  "giant-death": ["/audio/sfx/giant/giant-death.ogg"],
  "skeleton-deploy": ["/audio/sfx/skeleton/skeleton-deployment.ogg"],
  "skeleton-attack": ["/audio/sfx/skeleton/skeleton-attack-swing.ogg"],
  "skeleton-hit": [
    "/audio/sfx/skeleton/skeleton-hit-impact-01.ogg",
    "/audio/sfx/skeleton/skeleton-hit-impact-02.ogg",
    "/audio/sfx/skeleton/skeleton-hit-impact-03.ogg",
    "/audio/sfx/skeleton/skeleton-hit-impact-04.ogg"
  ],
  "skeleton-step": ["/audio/sfx/skeleton/skeleton-footsteps.ogg"],
  "skeleton-death": ["/audio/sfx/skeleton/skeleton-death.ogg"],
  "archer-deploy": ["/audio/sfx/archer/archer-deployment.ogg"],
  "archer-attack": ["/audio/sfx/archer/archer-arrow-shot.ogg"],
  "archer-step": ["/audio/sfx/archer/archer-footsteps.ogg"],
  "archer-death": ["/audio/sfx/archer/archer-death.ogg"],
  "baby-dragon-deploy": ["/audio/sfx/baby-dragon/baby-dragon-deployment.ogg"],
  "baby-dragon-attack": ["/audio/sfx/baby-dragon/baby-dragon-fire-breath.ogg"],
  "baby-dragon-wing": ["/audio/sfx/baby-dragon/baby-dragon-wing-flap.ogg"],
  "princess-tower-attack": ["/audio/sfx/towers/princess-tower-arrow-shot.ogg"],
  "king-tower-attack": ["/audio/sfx/towers/king-tower-projectile-shot.ogg"],
  "elixir-gain": ["/audio/sfx/elixir/elixir-pickup.ogg"],
  "double-elixir": ["/audio/sfx/elixir/double-elixir-start.ogg"],
  "triple-elixir": ["/audio/sfx/elixir/triple-elixir-start.ogg"],
  "cannon-deploy": ["/audio/sfx/cannon/cannon-deployment.ogg"],
  "cannon-attack": ["/audio/sfx/cannon/cannon-fire.ogg"],
  "arrows-impact": ["/audio/sfx/spells/arrows-impact.ogg"],
  "fireball-launch": ["/audio/sfx/spells/fireball-launch.ogg"],
  "fireball-explosion": ["/audio/sfx/spells/fireball-explosion.ogg"],
  "ui-click": ["/audio/sfx/ui/ui-button-click.ogg"],
  "ui-invalid": ["/audio/sfx/ui/ui-invalid-action.ogg"]
};

const SOUND_VOLUMES: Record<AudioEvent, number> = {
  "mini-pekka-deploy": 0.8,
  "mini-pekka-attack": 0.8,
  "mini-pekka-hit": 0.65,
  "mini-pekka-step": 0.28,
  "giant-deploy": 0.8,
  "giant-attack": 0.72,
  "giant-hit": 0.68,
  "giant-step": 0.42,
  "giant-death": 0.75,
  "skeleton-deploy": 0.68,
  "skeleton-attack": 0.48,
  "skeleton-hit": 0.42,
  "skeleton-step": 0.2,
  "skeleton-death": 0.52,
  "archer-deploy": 0.58,
  "archer-attack": 0.48,
  "archer-step": 0.18,
  "archer-death": 0.52,
  "baby-dragon-deploy": 0.72,
  "baby-dragon-attack": 0.58,
  "baby-dragon-wing": 0.2,
  "princess-tower-attack": 0.42,
  "king-tower-attack": 0.48,
  "elixir-gain": 0.42,
  "double-elixir": 0.72,
  "triple-elixir": 0.78,
  "cannon-deploy": 0.72,
  "cannon-attack": 0.62,
  "arrows-impact": 0.62,
  "fireball-launch": 0.64,
  "fireball-explosion": 0.78,
  "ui-click": 0.32,
  "ui-invalid": 0.48
};

const MAX_VOICES_PER_SOUND = 6;
const MAX_HIT_VOICES = 2;
const HIT_SOUND_MIN_INTERVAL_MS = 180;
const PITCH_VARIATION = 0.025;

export function createSoundEffects(): SoundEffects {
  const sources = new Map<AudioEvent, HTMLAudioElement[]>();
  const voices = new Map<AudioEvent, HTMLAudioElement[]>();
  const lastVariant = new Map<AudioEvent, number>();
  const lastUnitSoundAt = new Map<AudioEvent, number>();

  for (const [event, paths] of Object.entries(SOUND_SOURCES) as [AudioEvent, readonly string[]][]) {
    sources.set(event, paths.map((path) => {
      const audio = new Audio(path);
      audio.preload = "auto";
      return audio;
    }));
    voices.set(event, []);
  }

  let enabled = true;
  let volume = 1;
  let unlocked = false;
  let speed = 1;
  let lastHitSoundAt = Number.NEGATIVE_INFINITY;

  function removeVoice(event: AudioEvent, audio: HTMLAudioElement): void {
    const active = voices.get(event);
    if (!active) return;

    const index = active.indexOf(audio);
    if (index >= 0) active.splice(index, 1);
  }

  function stopVoice(event: AudioEvent, audio: HTMLAudioElement): void {
    audio.pause();
    audio.currentTime = 0;
    removeVoice(event, audio);
  }

  function stopAll(): void {
    for (const [event, active] of voices) {
      for (const audio of [...active]) stopVoice(event, audio);
    }
  }

  function chooseSource(event: AudioEvent): HTMLAudioElement | null {
    const options = sources.get(event);
    if (!options?.length) return null;

    if (options.length === 1) return options[0];

    const previous = lastVariant.get(event) ?? -1;
    let selected = Math.floor(Math.random() * options.length);

    if (selected === previous) {
      selected = (selected + 1 + Math.floor(Math.random() * (options.length - 1)))
        % options.length;
    }

    lastVariant.set(event, selected);
    return options[selected];
  }

  return {
    play(event: AudioEvent): void {
      if (!enabled || !unlocked) return;

      const now = Date.now();
      if (
        event === "skeleton-attack"
        || event === "skeleton-hit"
        || event === "skeleton-step"
        || event === "skeleton-death"
        || event === "archer-attack"
        || event === "archer-step"
        || event === "archer-death"
        || event === "baby-dragon-wing"
      ) {
        const previous = lastUnitSoundAt.get(event) ?? Number.NEGATIVE_INFINITY;
        const minimumInterval = event === "skeleton-step"
          || event === "archer-step"
          || event === "baby-dragon-wing" ? 115 : 95;
        if (now - previous < minimumInterval) return;
        lastUnitSoundAt.set(event, now);
      }

      if (event === "mini-pekka-hit" || event === "giant-hit") {
        if (now - lastHitSoundAt < HIT_SOUND_MIN_INTERVAL_MS) return;
        lastHitSoundAt = now;
      }

      const source = chooseSource(event);
      const active = voices.get(event);
      if (!source || !active) return;

      const voiceLimit = event === "mini-pekka-hit"
        || event === "giant-hit"
        || event === "skeleton-hit"
        || event === "skeleton-attack"
        || event === "skeleton-death"
        || event === "skeleton-step"
        || event === "archer-step"
        || event === "baby-dragon-wing"
        ? MAX_HIT_VOICES
        : MAX_VOICES_PER_SOUND;

      if (active.length >= voiceLimit) {
        stopVoice(event, active[0]);
      }

      const audio = source.cloneNode(true) as HTMLAudioElement;
      const pitch = 1 + (Math.random() * 2 - 1) * PITCH_VARIATION;
      audio.volume = SOUND_VOLUMES[event] * volume;
      audio.playbackRate = speed * pitch;
      audio.currentTime = 0;
      active.push(audio);

      audio.addEventListener("ended", () => removeVoice(event, audio), { once: true });
      void audio.play().catch(() => removeVoice(event, audio));
    },

    setVolume(value: number): void {
      volume = Math.max(0, Math.min(1, value));
      for (const [event, active] of voices) {
        for (const audio of active) audio.volume = SOUND_VOLUMES[event] * volume;
      }
    },

    setEnabled(value: boolean): void {
      enabled = value;
      if (!enabled) stopAll();
    },

    setSpeed(value: number): void {
      speed = value;
      for (const active of voices.values()) {
        for (const audio of active) audio.playbackRate = speed;
      }
    },

    unlock(): void {
      unlocked = true;
    },

    stopAll
  };
}
