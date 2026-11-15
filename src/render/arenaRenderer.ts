import { Application, Container, Graphics } from "pixi.js";
import type { Effect, GameState, Side, Tower, Unit } from "../game/types";

const WORLD_WIDTH = 720;
const WORLD_HEIGHT = 960;
const BLUE = 0x4b91d0;
const RED = 0xc9665d;
const BONE = 0xe8e1c7;

interface Point {
  x: number;
  y: number;
}

export class ArenaRenderer {
  public readonly app = new Application();

  private readonly world = new Container();
  private readonly arena = new Graphics();
  private readonly actors = new Graphics();
  private readonly projectiles = new Graphics();
  private readonly effects = new Graphics();
  private initialized = false;
  private lastWidth = 0;
  private lastHeight = 0;

  public async initialize(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      background: "#18221e",
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    });

    host.replaceChildren(this.app.canvas);
    this.world.addChild(this.arena, this.effects, this.actors, this.projectiles);
    this.app.stage.addChild(this.world);
    this.drawArena();
    this.initialized = true;
    this.fitWorld();
  }

  public render(state: GameState): void {
    if (!this.initialized) return;
    this.fitWorld();

    this.actors.clear();
    this.projectiles.clear();
    this.effects.clear();

    for (const tower of state.towers) this.drawTower(this.actors, tower);
    for (const unit of state.units) this.drawUnit(this.actors, unit, state.time);
    for (const projectile of state.projectiles) this.drawProjectile(this.projectiles, projectile.x, projectile.y, projectile.style);
    for (const effect of state.effects) this.drawEffect(this.effects, effect);
  }

  private fitWorld(): void {
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    if (width === this.lastWidth && height === this.lastHeight) return;

    this.lastWidth = width;
    this.lastHeight = height;
    const scale = Math.min((width - 20) / WORLD_WIDTH, (height - 20) / WORLD_HEIGHT);
    this.world.scale.set(scale);
    this.world.position.set(
      (width - WORLD_WIDTH * scale) / 2,
      (height - WORLD_HEIGHT * scale) / 2
    );
  }

  private drawArena(): void {
    const g = this.arena;
    g.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill(0x58734f);
    g.rect(16, 16, WORLD_WIDTH - 32, 928).fill(0x69845b);
    g.rect(24, 24, WORLD_WIDTH - 48, 420).fill(0x70895e);
    g.rect(24, 516, WORLD_WIDTH - 48, 420).fill(0x637f55);

    for (let row = 0; row < 15; row += 1) {
      for (let column = 0; column < 10; column += 1) {
        const x = 42 + column * 70 + (row % 2) * 14;
        const y = 48 + row * 62;
        g.circle(x, y, 1.5).fill((row + column) % 3 === 0 ? 0x789269 : 0x5c7951);
      }
    }

    g.rect(24, 448, 672, 64).fill(0x4b94a0);
    g.rect(24, 455, 672, 50).fill(0x5ba8ad);

    for (const x of [205, 515]) {
      g.roundRect(x - 44, 427, 88, 106, 9).fill(0x8e7450);
      g.roundRect(x - 38, 433, 76, 94, 7).fill(0xa98a5d);
      for (let plank = 0; plank < 7; plank += 1) {
        const y = 438 + plank * 13;
        g.moveTo(x - 37, y).lineTo(x + 37, y).stroke({ color: 0x806744, width: 2 });
      }
      g.moveTo(x - 48, 435).lineTo(x - 48, 525).stroke({ color: 0xc0a070, width: 4 });
      g.moveTo(x + 48, 435).lineTo(x + 48, 525).stroke({ color: 0xc0a070, width: 4 });
    }

    g.roundRect(12, 12, WORLD_WIDTH - 24, WORLD_HEIGHT - 24, 24).stroke({ color: 0xc0b58b, width: 5 });
    g.moveTo(24, 480).lineTo(696, 480).stroke({ color: 0xd1c99c, width: 1, alpha: 0.22 });
    g.circle(360, 480, 6).fill(0x91c1b8);
  }

  private drawTower(g: Graphics, tower: Tower): void {
    const teamColor = tower.side === "blue" ? BLUE : RED;
    const size = tower.kind === "king" ? 30 : 25;

    g.ellipse(tower.x, tower.y + 12, size + 7, size * 0.66).fill(0x344338);
    g.roundRect(tower.x - size, tower.y - size, size * 2, size * 2, 9).fill(0x3d473f);
    g.roundRect(tower.x - size + 3, tower.y - size + 3, size * 2 - 6, size * 2 - 6, 7).fill(teamColor);
    g.roundRect(tower.x - size * 0.53, tower.y - size * 0.54, size * 1.06, size * 1.08, 7).fill(0xd6c59a);
    g.circle(tower.x, tower.y - 2, size * 0.38).fill(tower.kind === "king" ? 0xe8d9b2 : 0xcab58d);
    g.circle(tower.x, tower.y - 2, size * 0.19).fill(teamColor);
    g.rect(tower.x - 4, tower.y - size - 5, 8, 11).fill(0xe4cf96);

    const healthWidth = size * 2;
    const healthRatio = Math.max(0, tower.hp / tower.maxHp);
    g.roundRect(tower.x - size, tower.y + size + 5, healthWidth, 4, 2).fill(0x29332d);
    if (healthRatio > 0) {
      g.roundRect(tower.x - size, tower.y + size + 5, healthWidth * healthRatio, 4, 2).fill(0x9bc47c);
    }
  }

  private rotate(unit: Unit, localX: number, localY: number): Point {
    const angle = unit.facing + Math.PI / 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return {
      x: unit.x + localX * cosine - localY * sine,
      y: unit.y + localX * sine + localY * cosine
    };
  }

  private segment(g: Graphics, unit: Unit, start: Point, end: Point, color: number, width: number): void {
    const a = this.rotate(unit, start.x, start.y);
    const b = this.rotate(unit, end.x, end.y);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width, cap: "round" });
  }

  private drawUnit(g: Graphics, unit: Unit, time: number): void {
    const teamColor = unit.side === "blue" ? BLUE : RED;
    const phase = time * (unit.speed > 0 ? 8.2 : 2) + unit.animationOffset;
    const stride = unit.kind === "building" ? 0 : Math.sin(phase) * 3;
    const attack = unit.attackAnim > 0 ? Math.sin((1 - unit.attackAnim / 0.32) * Math.PI) : 0;
    const scale = unit.type === "giant" ? 1.36 : unit.type === "skeleton" ? 0.74 : unit.type === "mini-pekka" ? 1.05 : 1;

    g.ellipse(unit.x, unit.y + unit.radius * 0.68, unit.radius * 1.28, unit.radius * 0.65)
      .fill(unit.side === "blue" ? 0x304f56 : 0x653f3d);

    if (unit.type === "cannon") {
      g.roundRect(unit.x - 16, unit.y - 14, 32, 28, 8).fill(0x46545a);
      g.roundRect(unit.x - 11, unit.y - 10, 22, 20, 6).fill(0x83908e);
      const front = this.rotate(unit, 0, -25);
      const back = this.rotate(unit, 0, 5);
      g.moveTo(back.x, back.y).lineTo(front.x, front.y).stroke({ color: 0x303b40, width: 11, cap: "round" });
      g.circle(front.x, front.y, 5).fill(0xb5b6a3);
      return;
    }

    if (unit.type === "skeleton") {
      const head = this.rotate(unit, 0, -10);
      g.circle(head.x, head.y, 5.1).fill(BONE);
      g.circle(head.x - 1.8, head.y - 0.4, 1.25).fill(0x3b4140);
      g.circle(head.x + 1.8, head.y - 0.4, 1.25).fill(0x3b4140);
      this.segment(g, unit, { x: 0, y: -4 }, { x: 0, y: 7 }, BONE, 3.6);
      this.segment(g, unit, { x: -5, y: -2 }, { x: 5, y: -2 }, BONE, 2.8);
      this.segment(g, unit, { x: -4, y: 1 }, { x: 4, y: 1 }, BONE, 2);
      this.segment(g, unit, { x: -5, y: -2 }, { x: -9, y: 3 + stride }, BONE, 2.5);
      this.segment(g, unit, { x: -9, y: 3 + stride }, { x: -11, y: 8 + stride }, BONE, 2.2);
      this.segment(g, unit, { x: 5, y: -2 }, { x: 9, y: 3 - stride + attack * 5 }, BONE, 2.5);
      this.segment(g, unit, { x: 9, y: 3 - stride + attack * 5 }, { x: 11, y: 8 - stride + attack * 5 }, BONE, 2.2);
      this.segment(g, unit, { x: -2, y: 7 }, { x: -5, y: 13 + stride }, BONE, 2.7);
      this.segment(g, unit, { x: -5, y: 13 + stride }, { x: -7, y: 17 + stride }, BONE, 2.4);
      this.segment(g, unit, { x: 2, y: 7 }, { x: 5, y: 13 - stride }, BONE, 2.7);
      this.segment(g, unit, { x: 5, y: 13 - stride }, { x: 7, y: 17 - stride }, BONE, 2.4);
      const swordStart = this.rotate(unit, 11, 8 - stride + attack * 5);
      const swordEnd = this.rotate(unit, 16 + attack * 5, -8);
      g.moveTo(swordStart.x, swordStart.y).lineTo(swordEnd.x, swordEnd.y).stroke({ color: 0xb8c6c2, width: 2.6, cap: "round" });
      return;
    }

    if (unit.type === "baby-dragon") {
      const wing = Math.sin(time * 12 + unit.animationOffset) * 6;
      g.ellipse(unit.x, unit.y + 1, 10, 16).fill(0x548f58);
      g.ellipse(unit.x - 15, unit.y - 2, 6, 13 + wing * 0.35).fill(0x78b66d);
      g.ellipse(unit.x + 15, unit.y - 2, 6, 13 + wing * 0.35).fill(0x78b66d);
      const head = this.rotate(unit, 0, -13);
      g.circle(head.x, head.y, 8).fill(0x7ebd70);
      g.circle(head.x - 3, head.y - 2, 1.5).fill(0xf5e9b0);
      g.circle(head.x + 3, head.y - 2, 1.5).fill(0xf5e9b0);
      this.segment(g, unit, { x: 0, y: 12 }, { x: 0, y: 22 }, 0x47784c, 3);
      return;
    }

    const bodyColor = unit.type === "giant"
      ? 0xc47a43
      : unit.type === "mini-pekka"
        ? 0x555f91
        : 0x537c82;
    const headColor = unit.type === "giant" ? 0xe2ae75 : unit.type === "mini-pekka" ? 0x7d88b4 : 0xd0b28a;

    g.ellipse(unit.x, unit.y + 1, unit.radius * 0.76 * scale, unit.radius * 0.95 * scale).fill(bodyColor);
    const head = this.rotate(unit, 0, -unit.radius * 0.68 * scale);
    g.circle(head.x, head.y, unit.radius * 0.43 * scale).fill(headColor);

    if (unit.type === "giant") {
      this.segment(g, unit, { x: -12, y: -3 }, { x: -19, y: 5 + stride }, bodyColor, 9);
      this.segment(g, unit, { x: 12, y: -3 }, { x: 19, y: 5 - stride }, bodyColor, 9);
      this.segment(g, unit, { x: -7, y: 12 }, { x: -9, y: 20 + stride }, 0x674a3c, 7);
      this.segment(g, unit, { x: 7, y: 12 }, { x: 9, y: 20 - stride }, 0x674a3c, 7);
      g.circle(head.x, head.y - 1, 2).fill(0x594332);
    } else if (unit.type === "mini-pekka") {
      g.circle(head.x - 5, head.y - 3, 4).fill(0x9aa6ce);
      g.circle(head.x + 5, head.y - 3, 4).fill(0x9aa6ce);
      this.segment(g, unit, { x: -7, y: -2 }, { x: -12, y: 7 + stride }, 0x505b84, 5);
      this.segment(g, unit, { x: 7, y: -2 }, { x: 12, y: 5 - stride + attack * 8 }, 0x505b84, 5);
      const swordStart = this.rotate(unit, 12, 5 - stride + attack * 8);
      const swordEnd = this.rotate(unit, 20 + attack * 8, -14);
      g.moveTo(swordStart.x, swordStart.y).lineTo(swordEnd.x, swordEnd.y).stroke({ color: 0xd5dfdf, width: 4, cap: "round" });
      this.segment(g, unit, { x: -5, y: 12 }, { x: -6, y: 18 + stride }, 0x343d63, 5);
      this.segment(g, unit, { x: 5, y: 12 }, { x: 6, y: 18 - stride }, 0x343d63, 5);
    } else {
      this.segment(g, unit, { x: -7, y: -2 }, { x: -13, y: 4 + stride }, 0x426a73, 3.5);
      this.segment(g, unit, { x: 7, y: -2 }, { x: 13, y: 4 - stride + attack * 4 }, 0x426a73, 3.5);
      g.circle(unit.x, unit.y + 1, 3).fill(teamColor);
      const bow = this.rotate(unit, 15, 0);
      g.circle(bow.x, bow.y, 8).stroke({ color: 0x9c7950, width: 2.2 });
      this.segment(g, unit, { x: -4, y: 12 }, { x: -5, y: 18 + stride }, 0x3b5559, 3.5);
      this.segment(g, unit, { x: 4, y: 12 }, { x: 5, y: 18 - stride }, 0x3b5559, 3.5);
    }

    g.circle(unit.x, unit.y, 2.3).fill(teamColor);
    const hpRatio = Math.max(0, unit.hp / unit.maxHp);
    if (hpRatio < 0.999) {
      g.roundRect(unit.x - unit.radius, unit.y + unit.radius + 4, unit.radius * 2, 3, 1.5).fill(0x2b332f);
      if (hpRatio > 0) {
        g.roundRect(unit.x - unit.radius, unit.y + unit.radius + 4, unit.radius * 2 * hpRatio, 3, 1.5).fill(0xa8c879);
      }
    }
  }

  private drawProjectile(g: Graphics, x: number, y: number, style: string): void {
    const color = style === "fire" || style === "fireball"
      ? 0xffa34c
      : style === "arrows"
        ? 0xd9d0ae
        : style === "cannon"
          ? 0xaab6b7
          : 0xe7d8a5;
    const radius = style === "fireball" ? 7 : style === "fire" ? 5 : style === "cannon" ? 4 : 2.8;
    g.circle(x, y, radius + 2).fill(style === "fireball" ? 0xd96735 : 0x39433c);
    g.circle(x, y, radius).fill(color);
  }

  private drawEffect(g: Graphics, effect: Effect): void {
    const progress = Math.min(1, effect.age / effect.lifetime);
    const radius = effect.style === "hit"
      ? effect.radius * (0.6 + progress * 0.8)
      : effect.radius * (0.45 + progress * 0.65);
    const color = effect.style === "hit" ? 0xf1e1a9 : effect.style === "arrows" ? 0xe2d6b6 : 0xffad55;
    g.circle(effect.x, effect.y, radius).stroke({ color, width: effect.style === "hit" ? 2 : 4 });
  }
}
