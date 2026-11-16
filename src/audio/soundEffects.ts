import type { AudioEvent } from "../game/types";

export interface SoundEffects {
  play(event: AudioEvent): void;
  setEnabled(enabled: boolean): void;
  setSpeed(speed: number): void;
  unlock(): void;
  stopAll(): void;
}

const SOUND_SOURCES: Record<AudioEvent, readonly string[]> = {
  "mini-pekka-deploy": ["/audio/sfx/mini-pekka/deploy.ogg"],
  "mini-pekka-attack": ["/audio/sfx/mini-pekka/attack.ogg"],
  "mini-pekka-hit": ["/audio/sfx/mini-pekka/hit.ogg"],
  "mini-pekka-step": ["/audio/sfx/mini-pekka/step.ogg"],
  "princess-tower-attack": ["/audio/sfx/towers/princess-attack.ogg"],
  "king-tower-attack": ["/audio/sfx/towers/king-attack.ogg"],
  "elixir-gain": ["/audio/sfx/elixir/get-elixir.ogg"],
  "double-elixir": ["/audio/sfx/elixir/double-elixir.ogg"],
  "triple-elixir": ["/audio/sfx/elixir/triple-elixir.ogg"]
};

const SOUND_VOLUMES: Record<AudioEvent, number> = {
  "mini-pekka-deploy": 0.8,
  "mini-pekka-attack": 0.8,
  "mini-pekka-hit": 0.65,
  "mini-pekka-step": 0.28,
  "princess-tower-attack": 0.42,
  "king-tower-attack": 0.48,
  "elixir-gain": 0.42,
  "double-elixir": 0.72,
  "triple-elixir": 0.78
};

const MAX_VOICES_PER_SOUND = 6;
const MAX_HIT_VOICES = 2;
const HIT_SOUND_MIN_INTERVAL_MS = 180;
const PITCH_VARIATION = 0.025;

export function createSoundEffects(): SoundEffects {
  const sources = new Map<AudioEvent, HTMLAudioElement[]>();
  const voices = new Map<AudioEvent, HTMLAudioElement[]>();
  const lastVariant = new Map<AudioEvent, number>();

  for (const [event, paths] of Object.entries(SOUND_SOURCES) as [AudioEvent, readonly string[]][]) {
    sources.set(event, paths.map((path) => {
      const audio = new Audio(path);
      audio.preload = "auto";
      return audio;
    }));
    voices.set(event, []);
  }

  let enabled = true;
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
      if (event === "mini-pekka-hit") {
        if (now - lastHitSoundAt < HIT_SOUND_MIN_INTERVAL_MS) return;
        lastHitSoundAt = now;
      }

      const source = chooseSource(event);
      const active = voices.get(event);
      if (!source || !active) return;

      const voiceLimit = event === "mini-pekka-hit"
        ? MAX_HIT_VOICES
        : MAX_VOICES_PER_SOUND;

      if (active.length >= voiceLimit) {
        stopVoice(event, active[0]);
      }

      const audio = source.cloneNode(true) as HTMLAudioElement;
      const pitch = 1 + (Math.random() * 2 - 1) * PITCH_VARIATION;
      audio.volume = SOUND_VOLUMES[event];
      audio.playbackRate = speed * pitch;
      audio.currentTime = 0;
      active.push(audio);

      audio.addEventListener("ended", () => removeVoice(event, audio), { once: true });
      void audio.play().catch(() => removeVoice(event, audio));
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
