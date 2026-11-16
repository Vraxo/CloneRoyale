import type { Container, Renderer } from "pixi.js";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./arenaView";

export const HUD_HEIGHT = 176;

export class WorldViewport {
  private lastWidth = 0;
  private lastHeight = 0;

  public constructor(
    private readonly renderer: Renderer,
    private readonly canvas: HTMLCanvasElement,
    private readonly world: Container
  ) {}

  public fit(): void {
    const width = this.renderer.screen.width;
    const height = this.renderer.screen.height;
    if (width === this.lastWidth && height === this.lastHeight) return;

    this.lastWidth = width;
    this.lastHeight = height;
    const availableHeight = Math.max(160, height - HUD_HEIGHT);
    const scale = Math.min(
      (width - 20) / WORLD_WIDTH,
      (availableHeight - 20) / WORLD_HEIGHT
    );

    this.world.scale.set(scale);
    this.world.position.set(
      (width - WORLD_WIDTH * scale) / 2,
      (availableHeight - WORLD_HEIGHT * scale) / 2
    );
  }

  public screenToWorld(
    clientX: number,
    clientY: number
  ): { x: number; y: number } | null {
    this.fit();
    const point = this.clientToScreen(clientX, clientY);
    if (!point) return null;

    const scale = this.world.scale.x;
    const x = (point.x - this.world.position.x) / scale;
    const y = (point.y - this.world.position.y) / scale;

    if (x < 0 || x > WORLD_WIDTH || y < 0 || y > WORLD_HEIGHT) return null;
    return { x, y };
  }

  public clientToScreen(
    clientX: number,
    clientY: number
  ): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    return {
      x: (clientX - rect.left) * (this.renderer.screen.width / rect.width),
      y: (clientY - rect.top) * (this.renderer.screen.height / rect.height)
    };
  }
}
