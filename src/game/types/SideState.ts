import type { CardId } from "./CardId";

export interface SideState {
  elixir: number;
  hand: CardId[];
  drawPile: CardId[];
  thinkIn: number;
  cardsPlayed: number;
}
