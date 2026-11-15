import type { CardId } from "./CardId";

export interface CardDefinitionBase {
  id: CardId;
  name: string;
  cost: number;
  deployTime?: number;
}
