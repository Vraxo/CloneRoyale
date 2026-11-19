import type { Application } from "pixi.js";
import type { BattleController } from "../app/battleController";

export function startBattleLoop(
  app: Application,
  controller: BattleController
): void {
  app.ticker.add((ticker) => {
    controller.update(ticker.deltaMS / 1000);
  });
}
