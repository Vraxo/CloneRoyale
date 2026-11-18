import type { BattleController } from "./battleController";
import type { AudioEvent, Side } from "../game/types";

const BATTLE_EMOTES = [
  { label: "Good game!" },
  { label: "Well played!" },
  { label: "Oops!" },
  { label: "Thanks!" },
  { label: "Wow!" },
  { label: "Good luck!" },
  { label: "Nice!" },
  { label: "Let's go!" },
  { label: "King thumbs up", image: "/emotes/emote-king-thumbs-up.png", audio: "emote-thumbs-up" },
  { label: "King angry", image: "/emotes/emote-king-angry.png", audio: "emote-angry" },
  { label: "King crying", image: "/emotes/emote-king-cry.png", audio: "emote-cry" },
  { label: "King laughing", image: "/emotes/emote-king-laugh.png", audio: "emote-laugh" }
] as const;

type BattleEmoteOptions = {
  battle: BattleController;
  getPlayerName: () => string;
  sendOnlineEmote: (emoteId: number) => void;
};

export function initializeBattleEmotes(options: BattleEmoteOptions) {
  const { battle, getPlayerName, sendOnlineEmote } = options;
  const emoteUi = document.getElementById("emote-ui");
  const emoteToggle = document.getElementById("emote-toggle");
  const emotePicker = document.getElementById("emote-picker");
  const bubbles = {
    blue: document.getElementById("emote-bubble-blue"),
    red: document.getElementById("emote-bubble-red")
  };
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  if (emoteUi instanceof HTMLElement) emoteUi.hidden = false;

  function closePicker(): void {
    if (emotePicker instanceof HTMLElement) emotePicker.hidden = true;
    emoteToggle?.setAttribute("aria-expanded", "false");
  }

  function showBattleEmote(side: Side, emoteId: number, name: string): void {
    const bubble = bubbles[side];
    const emote = BATTLE_EMOTES[emoteId];
    if (!(bubble instanceof HTMLElement) || !emote) return;

    const nameLabel = bubble.querySelector("span");
    const emoteLabel = bubble.querySelector("strong");
    const emoteImage = bubble.querySelector("img");
    if (nameLabel) nameLabel.textContent = name;
    if (emoteLabel) {
      emoteLabel.textContent = emote.label;
      emoteLabel.hidden = "image" in emote;
    }
    if (emoteImage) {
      if ("image" in emote) {
        emoteImage.src = emote.image;
        emoteImage.alt = emote.label;
        emoteImage.hidden = false;
      } else {
        emoteImage.hidden = true;
        emoteImage.removeAttribute("src");
      }
    }
    if ("audio" in emote) battle.soundEffects.play(emote.audio as AudioEvent);
    bubble.hidden = false;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      for (const item of Object.values(bubbles)) if (item) item.hidden = true;
      hideTimer = null;
    }, 2600);
  }

  emoteToggle?.addEventListener("click", () => {
    if (!(emotePicker instanceof HTMLElement)) return;
    emotePicker.hidden = !emotePicker.hidden;
    emoteToggle.setAttribute("aria-expanded", String(!emotePicker.hidden));
  });

  emotePicker?.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("button[data-emote-id]");
    if (!button) return;
    const emoteId = Number(button.dataset.emoteId);
    if (!Number.isInteger(emoteId) || emoteId < 0 || emoteId >= BATTLE_EMOTES.length) return;
    if (battle.isOnline) sendOnlineEmote(emoteId);
    else showBattleEmote("blue", emoteId, getPlayerName());
    closePicker();
  });

  document.addEventListener("pointerdown", event => {
    if (!(event.target instanceof Node) || !(emoteUi instanceof HTMLElement) || emoteUi.contains(event.target)) return;
    closePicker();
  });

  function reset(): void {
    closePicker();
    for (const item of Object.values(bubbles)) if (item) item.hidden = true;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
  }

  return { showBattleEmote, reset };
}
