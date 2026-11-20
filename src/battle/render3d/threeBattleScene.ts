import * as THREE from "three";
import type { ReadonlyGameState, Unit } from "../../game/types";
import { FIELD_HEIGHT, FIELD_WIDTH, RIVER_BOTTOM, RIVER_TOP } from "../../game/state";

const HALF_WIDTH = FIELD_WIDTH / 2;
const HALF_HEIGHT = FIELD_HEIGHT / 2;
type Model = THREE.Group;

export class ThreeBattleScene {
  public readonly canvas = document.createElement("canvas");
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, FIELD_WIDTH / FIELD_HEIGHT, 1, 2600);
  private readonly renderer = new THREE.WebGLRenderer({
    canvas: this.canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  private readonly towerModels = new Map<number, Model>();
  private readonly unitModels = new Map<number, Model>();
  private readonly projectileModels = new Map<number, THREE.Mesh>();
  private readonly effectModels = new Map<number, THREE.Mesh>();
  private readonly materials = {
    grass: new THREE.MeshStandardMaterial({ color: "#779b57", roughness: 1 }),
    grassLight: new THREE.MeshStandardMaterial({ color: "#8eaa68", roughness: 1 }),
    earth: new THREE.MeshStandardMaterial({ color: "#6b573e", roughness: 1 }),
    stone: new THREE.MeshStandardMaterial({ color: "#b6a27c", roughness: 0.9 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: "#645b48", roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: "#3c91a0", roughness: 0.28, metalness: 0.08 }),
    wood: new THREE.MeshStandardMaterial({ color: "#946b43", roughness: 0.88 }),
    blue: new THREE.MeshStandardMaterial({ color: "#438bc4", roughness: 0.65 }),
    red: new THREE.MeshStandardMaterial({ color: "#c85e50", roughness: 0.65 }),
    gold: new THREE.MeshStandardMaterial({ color: "#e6c477", metalness: 0.25, roughness: 0.45 }),
    dark: new THREE.MeshStandardMaterial({ color: "#39423a", roughness: 0.92 }),
    skin: new THREE.MeshStandardMaterial({ color: "#d9b58a", roughness: 0.86 }),
    metal: new THREE.MeshStandardMaterial({ color: "#aeb8bb", metalness: 0.62, roughness: 0.38 }),
    dragon: new THREE.MeshStandardMaterial({ color: "#6b9e69", roughness: 0.76 }),
    projectile: new THREE.MeshStandardMaterial({ color: "#f6b34b", emissive: "#b94d18", emissiveIntensity: 0.8 })
  };
  private readonly resizeObserver: ResizeObserver;
  private frame = 0;
  private readonly clock = new THREE.Clock();

  public constructor(private readonly host: HTMLElement) {
    this.canvas.className = "three-battle-canvas";
    this.canvas.setAttribute("aria-label", "Three-dimensional live battle arena");
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      zIndex: "0",
      pointerEvents: "none"
    });
    this.host.style.position = "relative";
    this.camera.position.set(0, 1190, 1190);
    this.camera.lookAt(0, 0, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene.background = new THREE.Color("#172c35");
    this.scene.fog = new THREE.Fog("#172c35", 1350, 2500);
    this.scene.add(new THREE.HemisphereLight("#dcecff", "#56613e", 2));
    const sun = new THREE.DirectionalLight("#fff0d2", 3.1);
    sun.position.set(-430, 850, 500);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -430;
    sun.shadow.camera.right = 430;
    sun.shadow.camera.top = 620;
    sun.shadow.camera.bottom = -620;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight("#9ac9ff", 1.05);
    fill.position.set(420, 380, -520);
    this.scene.add(fill);
    this.createArena();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.animate();
  }

  public render(state: ReadonlyGameState): void {
    this.syncTowers(state);
    this.syncUnits(state);
    this.syncProjectiles(state);
    this.syncEffects(state);
  }

  public destroy(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
    for (const material of Object.values(this.materials)) material.dispose();
    this.canvas.remove();
  }

  private addBox(parent: THREE.Object3D, width: number, height: number, depth: number,
    material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private addCylinder(parent: THREE.Object3D, top: number, bottom: number, height: number,
    material: THREE.Material, x: number, y: number, z: number, segments = 12): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private createArena(): void {
    const m = this.materials;
    this.addBox(this.scene, FIELD_WIDTH + 70, 34, FIELD_HEIGHT + 70, m.earth, 0, -28, 0);
    this.addBox(this.scene, FIELD_WIDTH + 38, 12, FIELD_HEIGHT + 38, m.stoneDark, 0, -5, 0);
    this.addBox(this.scene, FIELD_WIDTH, 8, FIELD_HEIGHT, m.grass, 0, 4, 0);
    for (let row = 0; row < 28; row += 1) {
      for (let column = 0; column < 16; column += 1) {
        const seed = (row * 31 + column * 17) % 13;
        if (seed < 5) continue;
        const tuft = new THREE.Mesh(
          new THREE.SphereGeometry(2.5 + seed % 4, 5, 4),
          seed % 3 === 0 ? m.grass : m.grassLight
        );
        tuft.position.set(-250 + column * 33 + (row % 2) * 13, 8, -460 + row * 34);
        tuft.scale.set(1.3, 0.34, 0.8);
        tuft.castShadow = false;
        this.scene.add(tuft);
      }
    }
    for (const laneX of [-165, 165]) {
      for (const centerZ of [-285, 285]) {
        this.addBox(this.scene, 82, 2, 390, m.earth, laneX, 9, centerZ);
      }
      const bridge = new THREE.Group();
      bridge.position.set(laneX - HALF_WIDTH, 0, 0);
      this.scene.add(bridge);
      this.addBox(bridge, 100, 12, 142, m.wood, 0, 13, 0);
      this.addBox(bridge, 92, 4, 132, m.gold, 0, 21, 0);
      for (let plank = 0; plank < 10; plank += 1) {
        this.addBox(bridge, 88, 2, 11, m.wood, 0, 24, -59 + plank * 13);
      }
      for (const side of [-1, 1]) {
        this.addBox(bridge, 8, 13, 142, m.wood, side * 48, 28, 0);
      }
    }
    this.addBox(this.scene, FIELD_WIDTH, 15, RIVER_BOTTOM - RIVER_TOP + 18,
      m.earth, 0, 1, 0);
    this.addBox(this.scene, FIELD_WIDTH - 8, 5, RIVER_BOTTOM - RIVER_TOP,
      m.water, 0, 10, 0);
    for (let i = 0; i < 17; i += 1) {
      const ripple = this.addBox(this.scene, 17 + (i % 3) * 8, 0.8, 2.2,
        m.stone, -260 + i * 32, 13, (i % 4 - 1.5) * 19);
      ripple.rotation.y = -0.13;
      ripple.castShadow = false;
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i += 1) {
        const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(13 + (i % 3) * 3, 1),
          i % 2 ? m.grass : m.grassLight);
        shrub.position.set(side * (250 + (i % 2) * 10), 14, -390 + i * 125);
        shrub.scale.y = 0.72;
        this.scene.add(shrub);
      }
    }
    for (const x of [-275, 275]) {
      this.addBox(this.scene, 18, 34, 18, m.stoneDark, x, 17, 0);
      this.addBox(this.scene, 25, 8, 25, m.stone, x, 38, 0);
    }
  }

  private createTower(tower: ReadonlyGameState["towers"][number]): Model {
    const group = new THREE.Group();
    const team = tower.side === "blue" ? this.materials.blue : this.materials.red;
    const king = tower.kind === "king";
    const base = king ? 43 : 34;
    const width = king ? 67 : 54;
    const height = king ? 76 : 62;
    this.addCylinder(group, base, base + 7, 15, this.materials.stoneDark, 0, 8, 0);
    this.addCylinder(group, base - 3, base, 9, this.materials.stone, 0, 18, 0);
    this.addBox(group, width, height, width, this.materials.stone, 0, 15 + height / 2, 0);
    this.addBox(group, width + 5, 8, width + 5, team, 0, height + 15, 0);
    this.addCylinder(group, king ? 31 : 25, king ? 35 : 29, 27, team, 0, height + 38, 0, 10);
    this.addCylinder(group, king ? 34 : 28, king ? 34 : 28, 8, this.materials.stone, 0, height + 54, 0, 10);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(king ? 36 : 30, king ? 42 : 35, 8),
      this.materials.dark);
    roof.position.y = height + 77;
    roof.rotation.y = Math.PI / 8;
    roof.castShadow = true;
    group.add(roof);
    for (let i = 0; i < 4; i += 1) {
      const angle = Math.PI / 4 + i * Math.PI / 2;
      this.addBox(group, 13, 20, 13, this.materials.stone,
        Math.cos(angle) * (king ? 38 : 31), height + 38, Math.sin(angle) * (king ? 38 : 31));
    }
    const pole = this.addCylinder(group, 1.8, 1.8, 48, this.materials.gold,
      width / 2 + 4, height + 65, 0, 6);
    pole.castShadow = false;
    const flag = this.addBox(group, 24, 16, 2, team, width / 2 + 15, height + 77, 0);
    flag.rotation.z = -0.12;
    this.scene.add(group);
    group.position.set(tower.x - HALF_WIDTH, 0, tower.y - HALF_HEIGHT);
    return group;
  }

  private createUnit(unit: Unit): Model {
    const group = new THREE.Group();
    const team = unit.side === "blue" ? this.materials.blue : this.materials.red;
    const bodyMaterial = unit.type === "baby-dragon" ? this.materials.dragon : team;
    const capsule = (radius: number, length: number, material: THREE.Material,
      x: number, y: number, z: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };
    if (unit.type === "cannon") {
      this.addCylinder(group, 17, 20, 10, this.materials.dark, 0, 12, 0);
      this.addCylinder(group, 12, 14, 12, team, 0, 22, 0);
      const barrel = this.addCylinder(group, 5, 7, 31, this.materials.metal, 0, 30, -8, 10);
      barrel.rotation.x = Math.PI / 2;
    } else if (unit.type === "baby-dragon") {
      capsule(12, 13, bodyMaterial, 0, 27, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(9, 10, 8), bodyMaterial);
      head.position.set(0, 31, -17);
      group.add(head);
      for (const side of [-1, 1]) {
        const wing = this.addBox(group, 25, 3, 16, bodyMaterial, side * 17, 31, 3);
        wing.rotation.z = side * 0.25;
      }
    } else if (unit.type === "giant") {
      capsule(14, 23, this.materials.skin, 0, 27, 0);
      capsule(17, 9, team, 0, 42, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(9, 10, 8), this.materials.skin);
      head.position.y = 54;
      group.add(head);
    } else if (unit.type === "mini-pekka") {
      this.addBox(group, 24, 30, 17, this.materials.metal, 0, 28, 0);
      this.addBox(group, 28, 9, 21, team, 0, 44, 0);
      const visor = this.addBox(group, 17, 5, 2, this.materials.gold, 0, 36, -10);
      visor.rotation.x = -0.1;
    } else if (unit.type === "skeleton") {
      capsule(5, 15, this.materials.stone, 0, 20, 0);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 7), this.materials.stone);
      skull.position.y = 34;
      group.add(skull);
    } else {
      capsule(unit.type === "knight" ? 10 : 8, 17, team, 0, 25, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 7), this.materials.skin);
      head.position.y = 39;
      group.add(head);
      if (unit.type === "archer") {
        const bow = this.addCylinder(group, 1.5, 1.5, 22, this.materials.gold, 10, 25, -2, 8);
        bow.rotation.z = Math.PI / 2;
      }
    }
    group.position.set(unit.transform.x - HALF_WIDTH, unit.movement?.isAir ? 38 : 5,
      unit.transform.y - HALF_HEIGHT);
    group.rotation.y = -unit.transform.facing;
    return group;
  }

  private syncTowers(state: ReadonlyGameState): void {
    const active = new Set<number>();
    for (const tower of state.towers) {
      active.add(tower.id);
      let model = this.towerModels.get(tower.id);
      if (!model) {
        model = this.createTower(tower);
        this.towerModels.set(tower.id, model);
      }
      model.visible = tower.hp > 0;
      model.position.set(tower.x - HALF_WIDTH, 0, tower.y - HALF_HEIGHT);
      const ratio = Math.max(0, Math.min(1, tower.hp / tower.maxHp));
      model.scale.y = 0.72 + ratio * 0.28;
      model.rotation.y = tower.activated ? Math.sin(state.time * 2) * 0.025 : 0;
    }
    this.removeMissing(this.towerModels, active);
  }

  private syncUnits(state: ReadonlyGameState): void {
    const active = new Set<number>();
    for (const unit of state.units) {
      active.add(unit.id);
      let model = this.unitModels.get(unit.id);
      if (!model) {
        model = this.createUnit(unit);
        this.unitModels.set(unit.id, model);
        this.scene.add(model);
      }
      model.position.set(unit.transform.x - HALF_WIDTH,
        unit.movement?.isAir ? 38 + Math.sin(state.time * 5 + unit.presentation.animationOffset) * 3 : 5,
        unit.transform.y - HALF_HEIGHT);
      model.rotation.y = -unit.transform.facing;
      const bob = unit.movement?.isMoving ? Math.sin(state.time * 13 + unit.presentation.animationOffset) * 0.045 : 0;
      model.rotation.z = bob;
    }
    this.removeMissing(this.unitModels, active);
  }

  private syncProjectiles(state: ReadonlyGameState): void {
    const active = new Set<number>();
    for (const projectile of state.projectiles) {
      active.add(projectile.id);
      let mesh = this.projectileModels.get(projectile.id);
      if (!mesh) {
        const geometry = projectile.style === "cannon"
          ? new THREE.SphereGeometry(7, 10, 8)
          : new THREE.SphereGeometry(projectile.style === "fireball" ? 12 : 4, 10, 8);
        mesh = new THREE.Mesh(geometry, this.materials.projectile);
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.projectileModels.set(projectile.id, mesh);
      }
      mesh.position.set(projectile.x - HALF_WIDTH, projectile.style === "fireball" ? 48 : 27,
        projectile.y - HALF_HEIGHT);
    }
    this.removeMissing(this.projectileModels, active);
  }

  private syncEffects(state: ReadonlyGameState): void {
    const active = new Set<number>();
    for (const effect of state.effects) {
      active.add(effect.id);
      let mesh = this.effectModels.get(effect.id);
      if (!mesh) {
        const geometry = new THREE.TorusGeometry(Math.max(3, effect.radius * 0.72), 1.8, 6, 32);
        const material = new THREE.MeshBasicMaterial({
          color: effect.style === "fireball" ? "#ff8a27" : effect.side === "red" ? "#e58a70" : "#79b8df",
          transparent: true,
          opacity: 0.7
        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        this.scene.add(mesh);
        this.effectModels.set(effect.id, mesh);
      }
      const progress = Math.min(1, effect.age / effect.lifetime);
      const expansion = 0.55 + progress * 0.9;
      mesh.position.set(effect.x - HALF_WIDTH, 12 + progress * 0.3, effect.y - HALF_HEIGHT);
      mesh.scale.setScalar(expansion);
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.72 * (1 - progress);
    }
    this.removeMissing(this.effectModels, active);
  }

  private removeMissing<T extends THREE.Object3D>(models: Map<number, T>, active: Set<number>): void {
    for (const [id, model] of models) {
      if (active.has(id)) continue;
      this.scene.remove(model);
      if (model instanceof THREE.Mesh) {
        model.geometry.dispose();
        if (Array.isArray(model.material)) model.material.forEach(material => material.dispose());
        else model.material.dispose();
      }
      models.delete(id);
    }
  }

  private resize(): void {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private animate = (): void => {
    this.frame = requestAnimationFrame(this.animate);
    const elapsed = this.clock.getElapsedTime();
    this.renderer.render(this.scene, this.camera);
    void elapsed;
  };
}
