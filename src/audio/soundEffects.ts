import type { AudioEvent } from "../game/types";

export interface SoundEffects {
  play(event: AudioEvent): void;
  setEnabled(enabled: boolean): void;
  setSpeed(speed: number): void;
  unlock(): void;
  stopAll(): void;
}

const SOUND_SOURCES: Record<AudioEvent, string> = {
  "mini-pekka-deploy": "/audio/sfx/mini-pekka/deploy.ogg",
  "mini-pekka-attack": "/audio/sfx/mini-pekka/attack.ogg",
  "mini-pekka-hit": "/audio/sfx/mini-pekka/hit.ogg",
  "mini-pekka-step": "/audio/sfx/mini-pekka/step.ogg"
};

const SOUND_VOLUMES: Record<AudioEvent, number> = {
  "mini-pekka-deploy": 0.8,
  "mini-pekka-attack": 0.8,
  "mini-pekka-hit": 0.65,
  "mini-pekka-step": 0.28
};

const MAX_VOICES_PER_SOUND = 6;

export function createSoundEffects(): SoundEffects {
  const sources = new Map<AudioEvent, HTMLAudioElement>();
  const voices = new Map<AudioEvent, HTMLAudioElement[]>();

  for (const [event, source] of Object.entries(SOUND_SOURCES) as [AudioEvent, string][]) {
    const audio = new Audio(source);
    audio.preload = "auto";
    sources.set(event, audio);
    voices.set(event, []);
  }

  let enabled = true;
  let unlocked = false;
  let speed = 1;

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

  return {
    play(event: AudioEvent): void {
      if (!enabled || !unlocked) return;

      const source = sources.get(event);
      const active = voices.get(event);
      if (!source || !active) return;

      if (active.length >= MAX_VOICES_PER_SOUND) {
        stopVoice(event, active[0]);
      }

      const audio = source.cloneNode(true) as HTMLAudioElement;
      audio.volume = SOUND_VOLUMES[event];
      audio.playbackRate = speed;
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
