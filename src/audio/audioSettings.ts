import type { BattleController } from "../app/battleController";

type MenuAudio = {
  setVolumes(soundEffectsVolume: number, musicVolume: number): void;
};

type AudioSettings = { soundEffectsVolume: number; musicVolume: number };
const STORAGE_KEY = "cloneroyale.settings";

function clampVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

function loadAudioSettings(): AudioSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<AudioSettings> | null;
    return {
      soundEffectsVolume: clampVolume(stored?.soundEffectsVolume, 1),
      musicVolume: clampVolume(stored?.musicVolume, 1)
    };
  } catch {
    return { soundEffectsVolume: 1, musicVolume: 1 };
  }
}

export function initializeAudioSettings(battle: BattleController, menuAudio: MenuAudio): void {
  const settings = loadAudioSettings();
  const soundEffectsVolume = document.getElementById("sound-effects-volume");
  const soundEffectsValue = document.getElementById("sound-effects-value");
  const musicVolume = document.getElementById("music-volume");
  const musicValue = document.getElementById("music-value");

  function render(): void {
    if (soundEffectsVolume instanceof HTMLInputElement) soundEffectsVolume.value = String(settings.soundEffectsVolume);
    if (soundEffectsValue) soundEffectsValue.textContent = Math.round(settings.soundEffectsVolume * 100) + "%";
    if (musicVolume instanceof HTMLInputElement) musicVolume.value = String(settings.musicVolume);
    if (musicValue) musicValue.textContent = Math.round(settings.musicVolume * 100) + "%";
    battle.soundEffects.setVolume(settings.soundEffectsVolume);
    battle.music.setVolume(settings.musicVolume);
    menuAudio.setVolumes(settings.soundEffectsVolume, settings.musicVolume);
  }

  function save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  soundEffectsVolume?.addEventListener("input", () => {
    if (!(soundEffectsVolume instanceof HTMLInputElement)) return;
    settings.soundEffectsVolume = clampVolume(Number(soundEffectsVolume.value), 1);
    render();
    save();
  });
  musicVolume?.addEventListener("input", () => {
    if (!(musicVolume instanceof HTMLInputElement)) return;
    settings.musicVolume = clampVolume(Number(musicVolume.value), 1);
    render();
    save();
  });
  render();
}
