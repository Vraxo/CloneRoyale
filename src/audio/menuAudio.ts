export interface MenuAudio {
  unlock(): void;
  playButton(): void;
  playTransition(): void;
  playLaunch(): void;
  startMusic(): void;
  stopMusic(): void;
  setVolumes(soundEffects: number, music: number): void;
}

export function createMenuAudio(): MenuAudio {
  const music = new Audio("/audio/music/home-menu-loop.ogg");
  music.loop = true;
  music.preload = "auto";

  const button = new Audio("/audio/sfx/ui/menu-click.ogg");
  const transition = new Audio("/audio/sfx/ui/menu-swipe.ogg");
  const launch = new Audio("/audio/sfx/ui/menu-play.ogg");
  for (const audio of [button, transition, launch]) audio.preload = "auto";

  let unlocked = false;
  let wantsMusic = false;
  let soundEffectsVolume = 1;
  let musicVolume = 1;

  function playOneShot(source: HTMLAudioElement, level: number): void {
    if (!unlocked || soundEffectsVolume <= 0) return;
    const audio = source.cloneNode(true) as HTMLAudioElement;
    audio.volume = Math.max(0, Math.min(1, level * soundEffectsVolume));
    void audio.play().catch(() => undefined);
  }

  function synchronizeMusic(): void {
    music.volume = 0.24 * musicVolume;
    if (!wantsMusic || !unlocked) {
      music.pause();
      return;
    }
    if (music.paused) void music.play().catch(() => undefined);
  }

  return {
    unlock(): void {
      unlocked = true;
      synchronizeMusic();
    },

    playButton(): void {
      playOneShot(button, 0.58);
    },

    playTransition(): void {
      playOneShot(transition, 0.52);
    },

    playLaunch(): void {
      playOneShot(launch, 0.72);
    },

    startMusic(): void {
      wantsMusic = true;
      synchronizeMusic();
    },

    stopMusic(): void {
      wantsMusic = false;
      music.pause();
      music.currentTime = 0;
    },

    setVolumes(soundEffects: number, musicLevel: number): void {
      soundEffectsVolume = Math.max(0, Math.min(1, soundEffects));
      musicVolume = Math.max(0, Math.min(1, musicLevel));
      synchronizeMusic();
    }
  };
}
