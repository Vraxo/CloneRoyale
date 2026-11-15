import type { CardId } from "./CardId";

export interface SideState {
  elixir: number;
  hand: CardId[];
  drawPile: CardId[];
  drawIndex: number;
  thinkIn: number;
  cardsPlayed: number;
}
