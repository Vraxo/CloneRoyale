import type { CardId } from "./Card";

export interface SideState {
  elixir: number;
  hand: CardId[];
  drawPile: CardId[];
  drawIndex: number;
  thinkIn: number;
  cardsPlayed: number;
}
