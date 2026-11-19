import { CARDS, STARTER_DECK } from "../game/cards";
import type { CardId } from "../game/types";

const STORAGE_KEY = "cloneroyale.deck";
const ALL_CARD_IDS = Object.keys(CARDS) as CardId[];

function loadPlayerDeck(): CardId[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (Array.isArray(stored) && stored.length === 8
      && stored.every(id => typeof id === "string" && Object.hasOwn(CARDS, id))
      && new Set(stored).size === 8) {
      return stored as CardId[];
    }
  } catch { /* Restore the starter deck when stored data is invalid. */ }
  return STARTER_DECK.slice();
}

export function initializeDeckScreen(setPlayerDeck: (deck: CardId[]) => void, setGameMenuOpen: (open: boolean) => void): void {
  let playerDeck = loadPlayerDeck();
  let selectedDeckSlot = 0;

  const decksPage = document.getElementById("decks-page");
  const deckSlots = document.getElementById("deck-slots");
  const deckCollection = document.getElementById("deck-collection");
  const deckCount = document.getElementById("deck-count");
  const deckAverage = document.getElementById("deck-average");
  const deckFeedback = document.getElementById("deck-feedback");
  const homeDeckPreview = document.getElementById("home-deck-preview");

  function makeDeckCard(cardId: CardId, slot: number, selected: boolean): HTMLButtonElement {
    const card = CARDS[cardId];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "deck-card" + (selected ? " is-selected" : "");
    button.setAttribute("aria-label", card.name + ", " + card.cost + " elixir");
    button.setAttribute("aria-pressed", String(selected));
    const cost = document.createElement("span");
    cost.className = "deck-card-cost";
    cost.textContent = String(card.cost);
    const image = document.createElement("img");
    image.src = "/cards/" + cardId + (cardId === "knight" ? ".svg" : ".png");
    image.alt = "";
    image.loading = "lazy";
    const name = document.createElement("span");
    name.className = "deck-card-name";
    name.textContent = card.name;
    button.append(cost, image, name);
    button.dataset.slot = String(slot);
    return button;
  }

  function renderHomeDeckPreview(): void {
    if (!(homeDeckPreview instanceof HTMLElement)) return;
    homeDeckPreview.replaceChildren();
    playerDeck.slice(0, 4).forEach(cardId => {
      const card = document.createElement("div");
      card.className = "cr-card-tile";
      const image = document.createElement("img");
      image.src = "/cards/" + cardId + (cardId === "knight" ? ".svg" : ".png");
      image.alt = CARDS[cardId].name;
      const name = document.createElement("span");
      name.textContent = CARDS[cardId].name.toUpperCase();
      card.append(image, name);
      homeDeckPreview.append(card);
    });
  }

  function renderDeckPage(): void {
    if (!(deckSlots instanceof HTMLElement) || !(deckCollection instanceof HTMLElement)) return;
    deckSlots.replaceChildren();
    deckCollection.replaceChildren();
    playerDeck.forEach((cardId, slot) => {
      const card = makeDeckCard(cardId, slot, slot === selectedDeckSlot);
      card.classList.add("deck-slot-card");
      card.addEventListener("click", () => {
        selectedDeckSlot = slot;
        renderDeckPage();
      });
      deckSlots.append(card);
    });
    ALL_CARD_IDS.forEach(cardId => {
      const card = makeDeckCard(cardId, STARTER_DECK.indexOf(cardId), false);
      card.classList.add("collection-card");
      card.addEventListener("click", () => {
        const currentIndex = playerDeck.indexOf(cardId);
        if (currentIndex === selectedDeckSlot) {
          if (deckFeedback) deckFeedback.textContent = CARDS[cardId].name + " is already in that slot.";
          return;
        }
        const displaced = playerDeck[selectedDeckSlot];
        playerDeck[selectedDeckSlot] = cardId;
        if (currentIndex >= 0) playerDeck[currentIndex] = displaced;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(playerDeck));
        setPlayerDeck(playerDeck);
        if (deckFeedback) deckFeedback.textContent = currentIndex >= 0
          ? CARDS[cardId].name + " swapped into slot " + (selectedDeckSlot + 1) + "."
          : CARDS[cardId].name + " added to your deck. " + CARDS[displaced].name + " returned to your collection.";
        renderDeckPage();
        renderHomeDeckPreview();
      });
      deckCollection.append(card);
    });
    if (deckCount) deckCount.textContent = playerDeck.length + "/8";
    if (deckAverage) {
      const average = playerDeck.reduce((total, id) => total + CARDS[id].cost, 0) / playerDeck.length;
      deckAverage.textContent = average.toFixed(1);
    }
  }

  function openDecksPage(): void {
    renderDeckPage();
    if (decksPage instanceof HTMLElement) decksPage.hidden = false;
    document.body.dataset.screen = "decks";
    setGameMenuOpen(false);
  }

  function closeDecksPage(): void {
    if (decksPage instanceof HTMLElement) decksPage.hidden = true;
    document.body.dataset.screen = "home";
  }

  setPlayerDeck(playerDeck);
  renderDeckPage();
  renderHomeDeckPreview();
  document.getElementById("menu-decks")?.addEventListener("click", openDecksPage);
  document.getElementById("decks-back")?.addEventListener("click", closeDecksPage);
  document.getElementById("decks-done")?.addEventListener("click", closeDecksPage);
}
