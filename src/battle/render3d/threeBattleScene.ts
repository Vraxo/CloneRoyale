import * as THREE from "three";
import type { CardId, ReadonlyGameState, Side, Unit } from "../../game/types";
import { cardById } from "../../game/cards";
import { FIELD_HEIGHT, FIELD_WIDTH, RIVER_BOTTOM, RIVER_TOP } from "../../game/state";

const HALF_WIDTH = FIELD_WIDTH / 2;
const HALF_HEIGHT = FIELD_HEIGHT / 2;
const CAMERA_DISTANCE = 1680;
const CAMERA_TILT = THREE.MathUtils.degToRad(55);
type Model = THREE.Group;
interface UnitRig {
  root: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  wings: THREE.Group[];
  weapon: THREE.Group | null;
  isBuilding: boolean;
}
interface FireballProjectileRig {
  aura: THREE.Mesh;
  core: THREE.Mesh;
  flames: THREE.Mesh[];
  trail: THREE.Mesh[];
}
interface ProjectileModel extends THREE.Group {
  fireball?: FireballProjectileRig;
}
interface FireballEffectRig {
  shockwave: THREE.Mesh;
  innerRing: THREE.Mesh;
  glow: THREE.Mesh;
  flames: THREE.Mesh[];
  embers: THREE.Mesh[];
  smoke: THREE.Mesh[];
}
interface EffectModel extends THREE.Group {
  fireball?: FireballEffectRig;
}

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
  private readonly unitModels = new Map<number, UnitRig>();
  private readonly projectileModels = new Map<number, ProjectileModel>();
  private readonly effectModels = new Map<number, EffectModel>();
  private readonly preview = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -8);
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
    // A fixed, elevated oblique view: strategic top-down readability without a flat bird's-eye angle.
    this.camera.position.set(0,
      Math.sin(CAMERA_TILT) * CAMERA_DISTANCE,
      Math.cos(CAMERA_TILT) * CAMERA_DISTANCE
    );
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
    this.scene.add(this.preview);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.animate();
  }

  public screenToWorld(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const intersection = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, intersection)) return null;
    const x = intersection.x + HALF_WIDTH;
    const y = intersection.z + HALF_HEIGHT;
    if (x < 0 || x > FIELD_WIDTH || y < 0 || y > FIELD_HEIGHT) return null;
    return { x, y };
  }

  public setPreview(cardId: CardId, point: { x: number; y: number }, side: Side): void {
    this.clearPreview();
    const card = cardById(cardId);
    const color = side === "blue" ? "#91c9ff" : "#ff958c";
    if (card.category === "spell") {
      const ring = new THREE.Mesh(
        new THREE.CircleGeometry(card.effect.radius, 48),
        new THREE.MeshBasicMaterial({ color: card.preview?.style === "arrows" ? "#e5c47f" : "#ff8b3d", transparent: true, opacity: 0.22, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(point.x - HALF_WIDTH, 9, point.y - HALF_HEIGHT);
      this.preview.add(ring);
      return;
    }
    const spacing = Math.max(18, card.unit.collision.radius * 2 + 8);
    const columns = Math.min(card.count, 5);
    const rows = Math.ceil(card.count / columns);
    for (let index = 0; index < card.count; index += 1) {
      const x = point.x + (index % columns - (columns - 1) / 2) * spacing;
      const y = point.y + (Math.floor(index / columns) - (rows - 1) / 2) * spacing;
      const marker = new THREE.Mesh(
        new THREE.CircleGeometry(card.unit.collision.radius * 0.8, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(x - HALF_WIDTH, 9, y - HALF_HEIGHT);
      this.preview.add(marker);
    }
  }

  public clearPreview(): void {
    for (const child of [...this.preview.children]) {
      this.preview.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) material.dispose();
      }
    }
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
      bridge.position.set(laneX, 0, 0);
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

  private createUnit(unit: Unit): UnitRig {
    const root = new THREE.Group();
    const team = unit.side === "blue" ? this.materials.blue : this.materials.red;
    const darkTeam = unit.side === "blue"
      ? new THREE.MeshStandardMaterial({ color: "#28527b", roughness: 0.8 })
      : new THREE.MeshStandardMaterial({ color: "#793b38", roughness: 0.8 });
    const skin = this.materials.skin;
    const leftLeg = new THREE.Group();
    const rightLeg = new THREE.Group();
    const leftArm = new THREE.Group();
    const rightArm = new THREE.Group();
    const wings: THREE.Group[] = [];
    let weapon: THREE.Group | null = null;
    const isBuilding = unit.kind === "building";

    const capsule = (parent: THREE.Object3D, radius: number, length: number,
      material: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const sphere = (parent: THREE.Object3D, radius: number, material: THREE.Material,
      x: number, y: number, z: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 12), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const pivot = (x: number, y: number, z: number): THREE.Group => {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      root.add(group);
      return group;
    };
    const makeSword = (parent: THREE.Object3D, scale = 1): THREE.Group => {
      const sword = new THREE.Group();
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(4 * scale, 27 * scale, 3 * scale),
        this.materials.metal
      );
      blade.position.y = -15 * scale;
      blade.castShadow = true;
      sword.add(blade);
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(13 * scale, 3 * scale, 5 * scale),
        this.materials.gold
      );
      guard.position.y = -2 * scale;
      sword.add(guard);
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(2 * scale, 2 * scale, 10 * scale, 8),
        this.materials.wood
      );
      grip.position.y = 5 * scale;
      sword.add(grip);
      parent.add(sword);
      return sword;
    };

    if (unit.type === "cannon") {
      this.addCylinder(root, 20, 23, 12, this.materials.dark, 0, 12, 0);
      this.addCylinder(root, 14, 17, 15, team, 0, 24, 0);
      const barrelPivot = new THREE.Group();
      barrelPivot.position.set(0, 31, -5);
      root.add(barrelPivot);
      const barrel = this.addCylinder(barrelPivot, 5, 7, 38, this.materials.metal, 0, 0, -16, 12);
      barrel.rotation.x = Math.PI / 2;
      this.addCylinder(barrelPivot, 8, 8, 3, this.materials.dark, 0, 0, -34, 12);
      return { root, leftLeg, rightLeg, leftArm, rightArm, wings, weapon: barrelPivot, isBuilding: true };
    }

    if (unit.type === "baby-dragon") {
      const body = new THREE.Group();
      root.add(body);
      capsule(body, 13, 19, this.materials.dragon, 0, 27, 0);
      sphere(body, 10, this.materials.dragon, 0, 36, -17);
      sphere(body, 2.2, this.materials.gold, -4, 39, -25);
      sphere(body, 2.2, this.materials.gold, 4, 39, -25);
      const snout = new THREE.Mesh(new THREE.ConeGeometry(5, 12, 8), this.materials.dragon);
      snout.rotation.x = -Math.PI / 2;
      snout.position.set(0, 32, -28);
      body.add(snout);
      for (const side of [-1, 1]) {
        const wing = new THREE.Group();
        wing.position.set(side * 9, 34, 1);
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(side * 20, 12, side * 35, 8);
        shape.quadraticCurveTo(side * 24, -13, side * 10, -15);
        shape.lineTo(0, 0);
        const wingShape = new THREE.ShapeGeometry(shape);
        const wingMesh = new THREE.Mesh(wingShape, this.materials.dragon);
        wingMesh.material = new THREE.MeshStandardMaterial({ color: "#80ad69", side: THREE.DoubleSide, roughness: 0.8 });
        wingMesh.castShadow = true;
        wing.add(wingMesh);
        const bone = this.addCylinder(wing, 1.5, 1.5, 37, this.materials.dark, side * 15, 0, 0, 6);
        bone.rotation.z = side * Math.PI / 2;
        root.add(wing);
        wings.push(wing);
      }
      const tail = new THREE.Mesh(new THREE.ConeGeometry(6, 24, 8), this.materials.dragon);
      tail.rotation.x = Math.PI / 2;
      tail.position.set(0, 22, 19);
      root.add(tail);
      return { root, leftLeg, rightLeg, leftArm, rightArm, wings, weapon: null, isBuilding: false };
    }

    const giant = unit.type === "giant";
    const pekka = unit.type === "mini-pekka";
    const skeleton = unit.type === "skeleton";
    const knight = unit.type === "knight";
    const archer = unit.type === "archer";
    const height = giant ? 66 : pekka ? 57 : skeleton ? 43 : 54;
    const torsoMaterial = giant ? darkTeam : pekka ? this.materials.metal : skeleton ? this.materials.stone : team;
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(giant ? 17 : pekka ? 14 : skeleton ? 7 : 11, giant ? 21 : 17, 5, 12),
      torsoMaterial
    );
    torso.position.y = giant ? 39 : 31;
    torso.castShadow = true;
    root.add(torso);

    if (giant) {
      const belt = this.addBox(root, 34, 7, 22, this.materials.wood, 0, 29, 0);
      belt.rotation.x = 0.04;
      sphere(root, 12, skin, 0, 59, -1);
      this.addBox(root, 18, 7, 15, darkTeam, 0, 51, 0);
      for (const side of [-1, 1]) {
        const pauldron = sphere(root, 11, this.materials.wood, side * 19, 48, 0);
        pauldron.scale.set(1.25, 0.8, 1);
      }
    } else if (pekka) {
      const helmet = new THREE.Mesh(new THREE.ConeGeometry(15, 22, 6), this.materials.metal);
      helmet.position.set(0, 56, 0);
      helmet.rotation.y = Math.PI / 6;
      root.add(helmet);
      this.addBox(root, 20, 6, 3, this.materials.gold, 0, 53, -12);
      this.addBox(root, 24, 8, 23, team, 0, 43, 0);
      const crest = this.addBox(root, 3, 17, 5, this.materials.gold, 0, 68, 0);
      crest.rotation.z = 0.18;
    } else if (skeleton) {
      sphere(root, 8, this.materials.stone, 0, 52, 0);
      this.addBox(root, 11, 3, 2, this.materials.dark, 0, 53, -7);
      for (const side of [-1, 1]) {
        sphere(root, 2, this.materials.dark, side * 3, 53, -7.5);
      }
    } else {
      sphere(root, knight ? 8.5 : 7.5, skin, 0, height - 2, -1);
      if (knight) {
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.72), this.materials.metal);
        helmet.position.set(0, height + 1, 0);
        root.add(helmet);
        this.addBox(root, 13, 4, 3, this.materials.gold, 0, height - 2, -9);
        const plume = new THREE.Mesh(new THREE.ConeGeometry(4, 17, 7), this.materials.red);
        plume.position.set(0, height + 13, 2);
        root.add(plume);
      }
      if (archer) {
        const hood = new THREE.Mesh(new THREE.ConeGeometry(11, 17, 7), this.materials.red);
        hood.position.set(0, height + 6, 1);
        root.add(hood);
        const quiver = this.addBox(root, 8, 19, 8, this.materials.wood, 10, 35, 5);
        quiver.rotation.z = -0.25;
      }
    }

    leftLeg.position.set(-7, 22, 0);
    rightLeg.position.set(7, 22, 0);
    capsule(leftLeg, skeleton ? 2.8 : 5.5, skeleton ? 13 : 15, skeleton ? this.materials.stone : darkTeam, 0, -9, 0);
    capsule(rightLeg, skeleton ? 2.8 : 5.5, skeleton ? 13 : 15, skeleton ? this.materials.stone : darkTeam, 0, -9, 0);
    this.addBox(leftLeg, 8, 5, 13, this.materials.dark, 0, -19, -2);
    this.addBox(rightLeg, 8, 5, 13, this.materials.dark, 0, -19, -2);
    root.add(leftLeg, rightLeg);

    leftArm.position.set(-14, 42, 0);
    rightArm.position.set(14, 42, 0);
    capsule(leftArm, skeleton ? 2.5 : 5, 14, skeleton ? this.materials.stone : torsoMaterial, 0, -9, 0);
    capsule(rightArm, skeleton ? 2.5 : 5, 14, skeleton ? this.materials.stone : torsoMaterial, 0, -9, 0);
    sphere(leftArm, skeleton ? 3 : 5, skeleton ? this.materials.stone : skin, 0, -18, -1);
    sphere(rightArm, skeleton ? 3 : 5, skeleton ? this.materials.stone : skin, 0, -18, -1);
    root.add(leftArm, rightArm);

    if (knight || pekka || skeleton) {
      weapon = makeSword(rightArm, pekka ? 1.3 : skeleton ? 0.65 : 0.95);
      weapon.position.set(0, -18, -3);
      if (knight) {
        const shield = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 3, 8), this.materials.gold);
        shield.rotation.x = Math.PI / 2;
        shield.position.set(0, -17, -6);
        leftArm.add(shield);
        const boss = sphere(leftArm, 3, this.materials.red, 0, -17, -8);
        boss.scale.z = 0.5;
      }
    } else if (archer) {
      weapon = new THREE.Group();
      const bow = new THREE.Mesh(new THREE.TorusGeometry(10, 1.8, 6, 16, Math.PI), this.materials.wood);
      bow.rotation.z = Math.PI / 2;
      bow.position.set(0, -12, -4);
      weapon.add(bow);
      const string = this.addCylinder(weapon, 0.6, 0.6, 20, this.materials.gold, 0, -12, -4, 5);
      string.rotation.z = Math.PI / 2;
      rightArm.add(weapon);
    } else if (giant) {
      const fist = sphere(rightArm, 7, skin, 0, -18, -2);
      fist.scale.set(1.15, 1, 1.1);
    }

    return { root, leftLeg, rightLeg, leftArm, rightArm, wings, weapon, isBuilding };
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
      let rig = this.unitModels.get(unit.id);
      if (!rig) {
        rig = this.createUnit(unit);
        this.unitModels.set(unit.id, rig);
        this.scene.add(rig.root);
      }

      const root = rig.root;
      const moving = unit.kind === "troop" && unit.movement.isMoving;
      const airborne = unit.kind === "troop" && unit.movement.isAir;
      const phase = state.time * (moving ? 11 : 2.2) + unit.presentation.animationOffset;
      const stride = moving ? Math.sin(phase) * 0.62 : Math.sin(phase) * 0.025;
      const attackProgress = unit.presentation.attackAnim > 0
        ? Math.sin((1 - unit.presentation.attackAnim / 0.32) * Math.PI)
        : 0;
      const attackSwing = attackProgress * 1.1;

      root.position.set(
        unit.transform.x - HALF_WIDTH,
        airborne ? 39 + Math.sin(state.time * 5 + unit.presentation.animationOffset) * 4 : 5,
        unit.transform.y - HALF_HEIGHT
      );
      root.rotation.y = -unit.transform.facing;
      root.rotation.z = moving ? Math.sin(phase * 0.5) * 0.035 : 0;
      root.scale.setScalar(unit.type === "giant" ? 1.08 : unit.type === "skeleton" ? 0.9 : 1);

      if (!rig.isBuilding && unit.type !== "baby-dragon") {
        rig.leftLeg.rotation.x = stride;
        rig.rightLeg.rotation.x = -stride;
        rig.leftArm.rotation.x = -stride * 0.72 - attackSwing * 0.25;
        rig.rightArm.rotation.x = stride * 0.72 - attackSwing;
        rig.rightArm.rotation.z = -attackSwing * 0.6;
        if (unit.type === "archer" && rig.weapon) {
          rig.weapon.rotation.x = attackSwing * 0.3;
        }
      }

      if (unit.type === "baby-dragon") {
        const flap = Math.sin(state.time * 10 + unit.presentation.animationOffset) * 0.48;
        rig.wings.forEach((wing, index) => {
          wing.rotation.z = (index === 0 ? -1 : 1) * (0.18 + flap);
          wing.rotation.x = Math.sin(state.time * 5 + index) * 0.12;
        });
      }

      if (unit.type === "cannon" && rig.weapon) {
        rig.weapon.rotation.y = Math.sin(state.time * 1.5 + unit.presentation.animationOffset) * 0.04;
      }
    }
    for (const [id, rig] of this.unitModels) {
      if (active.has(id)) continue;
      this.scene.remove(rig.root);
      rig.root.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          if (!Object.values(this.materials).includes(material as never)) material.dispose();
        }
      });
      this.unitModels.delete(id);
    }
  }

  private syncProjectiles(state: ReadonlyGameState): void {
    const active = new Set<number>();
    for (const projectile of state.projectiles) {
      active.add(projectile.id);
      let model = this.projectileModels.get(projectile.id);
      if (!model) {
        model = new THREE.Group() as ProjectileModel;
        if (projectile.style === "fireball") {
          model.fireball = this.createFireballProjectile();
        } else {
          const radius = projectile.style === "cannon" ? 7 : 4;
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), this.materials.projectile);
          mesh.castShadow = true;
          model.add(mesh);
        }
        if (model.fireball) {
          const rig = model.fireball;
          model.add(rig.aura, rig.core, ...rig.flames, ...rig.trail);
        }
        this.scene.add(model);
        this.projectileModels.set(projectile.id, model);
      }
      model.position.set(projectile.x - HALF_WIDTH, projectile.style === "fireball" ? 43 : 27,
        projectile.y - HALF_HEIGHT);
      if (projectile.style === "fireball" && model.fireball) {
        const rig = model.fireball;
        const angle = Math.atan2(projectile.targetX - projectile.startX, projectile.targetY - projectile.startY);
        model.rotation.y = angle;
        const pulse = 1 + Math.sin(projectile.age * 27) * 0.055;
        rig.core.scale.setScalar(pulse);
        rig.aura.scale.setScalar(0.92 + Math.sin(projectile.age * 19) * 0.1);
        rig.flames.forEach((flame, index) => {
          flame.rotation.y = projectile.age * (index % 2 ? -1.8 : 1.5) + index * 2.1;
          flame.scale.y = 0.82 + Math.sin(projectile.age * 31 + index * 1.7) * 0.22;
        });
        rig.trail.forEach((particle, index) => {
          const phase = projectile.age * 15 + index * 2.4;
          particle.position.set(
            -10 - index * 5,
            Math.sin(phase) * (2.5 + index * 0.45),
            Math.cos(phase * 0.8) * (2 + index * 0.35)
          );
          const life = 1 - index / rig.trail.length;
          particle.scale.setScalar(life * (0.8 + Math.sin(phase) * 0.16));
        });
      }
    }
    this.removeMissing(this.projectileModels, active);
  }

  private createFireballProjectile(): FireballProjectileRig {
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(17, 16, 12),
      new THREE.MeshBasicMaterial({ color: "#f04417", transparent: true, opacity: 0.2, depthWrite: false })
    );
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(9, 18, 14),
      new THREE.MeshStandardMaterial({ color: "#ff9a25", emissive: "#ff4b12", emissiveIntensity: 2.8, roughness: 0.35 })
    );
    core.castShadow = true;
    const flameMaterial = new THREE.MeshBasicMaterial({
      color: "#ff5a16", transparent: true, opacity: 0.94, side: THREE.DoubleSide, depthWrite: false
    });
    const hotFlameMaterial = new THREE.MeshBasicMaterial({
      color: "#ffd15a", transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false
    });
    const flames: THREE.Mesh[] = [];
    for (let index = 0; index < 7; index += 1) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(index % 3 === 0 ? 4.4 : 3.2, 17 + (index % 3) * 3, 7),
        index % 3 === 0 ? hotFlameMaterial : flameMaterial
      );
      flame.position.set(-3, 0, 0);
      flame.rotation.z = Math.PI / 2;
      flame.rotation.y = index * 2.399;
      flame.castShadow = false;
      flames.push(flame);
    }
    const trail: THREE.Mesh[] = [];
    for (let index = 0; index < 8; index += 1) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(1.8 + (index % 3) * 0.65, 7, 6),
        new THREE.MeshBasicMaterial({
          color: index % 2 ? "#ff6a1c" : "#ffd36a",
          transparent: true,
          opacity: 0.82,
          depthWrite: false
        })
      );
      trail.push(particle);
    }
    return { aura, core, flames, trail };
  }

  private syncEffects(state: ReadonlyGameState): void {
    const active = new Set<number>();
    for (const effect of state.effects) {
      active.add(effect.id);
      let model = this.effectModels.get(effect.id);
      if (!model) {
        model = new THREE.Group() as EffectModel;
        if (effect.style === "fireball") {
          model.fireball = this.createFireballExplosion(effect.radius);
          const rig = model.fireball;
          model.add(rig.shockwave, rig.innerRing, rig.glow, ...rig.flames, ...rig.embers, ...rig.smoke);
        } else {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(Math.max(3, effect.radius * 0.72), 1.8, 6, 32),
            new THREE.MeshBasicMaterial({
              color: effect.side === "red" ? "#e58a70" : "#79b8df",
              transparent: true,
              opacity: 0.7
            })
          );
          ring.rotation.x = -Math.PI / 2;
          model.add(ring);
        }
        this.scene.add(model);
        this.effectModels.set(effect.id, model);
      }
      model.position.set(effect.x - HALF_WIDTH, 9, effect.y - HALF_HEIGHT);
      const progress = Math.min(1, effect.age / effect.lifetime);
      if (effect.style === "fireball" && model.fireball) {
        this.updateFireballExplosion(model.fireball, progress, effect.age);
      } else {
        const ring = model.children[0] as THREE.Mesh;
        ring.scale.setScalar(0.55 + progress * 0.9);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.72 * (1 - progress);
      }
    }
    this.removeMissing(this.effectModels, active);
  }

  private createFireballExplosion(radius: number): FireballEffectRig {
    const shockwave = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.58, Math.max(2, radius * 0.035), 8, 64),
      new THREE.MeshBasicMaterial({ color: "#ffd16a", transparent: true, opacity: 0.9, depthWrite: false })
    );
    shockwave.rotation.x = -Math.PI / 2;
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.42, Math.max(1.5, radius * 0.018), 6, 64),
      new THREE.MeshBasicMaterial({ color: "#ff641e", transparent: true, opacity: 0.78, depthWrite: false })
    );
    innerRing.rotation.x = -Math.PI / 2;
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.42, 20, 14),
      new THREE.MeshBasicMaterial({ color: "#ff6a1b", transparent: true, opacity: 0.72, depthWrite: false })
    );
    glow.position.y = 16;
    const flames: THREE.Mesh[] = [];
    for (let index = 0; index < 16; index += 1) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(radius * (index % 4 === 0 ? 0.105 : 0.075), radius * (0.58 + (index % 3) * 0.12), 7),
        new THREE.MeshBasicMaterial({
          color: index % 4 === 0 ? "#ffd05a" : index % 2 === 0 ? "#ff8a20" : "#e83d18",
          transparent: true,
          opacity: 0.94,
          depthWrite: false
        })
      );
      const angle = index / 16 * Math.PI * 2;
      const direction = new THREE.Vector3(Math.cos(angle), 0.12, Math.sin(angle)).normalize();
      flame.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      flame.position.set(Math.cos(angle) * radius * 0.16, 11, Math.sin(angle) * radius * 0.16);
      flames.push(flame);
    }
    const embers: THREE.Mesh[] = [];
    for (let index = 0; index < 24; index += 1) {
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(1.7 + (index % 3) * 0.7, 7, 6),
        new THREE.MeshBasicMaterial({
          color: index % 3 === 0 ? "#fff0a3" : "#ff7a22",
          transparent: true,
          opacity: 0.95,
          depthWrite: false
        })
      );
      embers.push(ember);
    }
    const smoke: THREE.Mesh[] = [];
    for (let index = 0; index < 9; index += 1) {
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(1, 9, 7),
        new THREE.MeshStandardMaterial({ color: "#4d4038", transparent: true, opacity: 0.26, roughness: 1, depthWrite: false })
      );
      smoke.push(cloud);
    }
    return { shockwave, innerRing, glow, flames, embers, smoke };
  }

  private updateFireballExplosion(rig: FireballEffectRig, progress: number, age: number): void {
    const expansion = 1 - Math.pow(1 - progress, 3);
    const fade = Math.pow(1 - progress, 1.15);
    rig.shockwave.scale.setScalar(0.35 + expansion * 1.42);
    rig.innerRing.scale.setScalar(0.25 + expansion * 1.08);
    (rig.shockwave.material as THREE.MeshBasicMaterial).opacity = 0.88 * fade;
    (rig.innerRing.material as THREE.MeshBasicMaterial).opacity = 0.7 * fade;
    rig.glow.scale.setScalar(0.55 + expansion * 0.82);
    (rig.glow.material as THREE.MeshBasicMaterial).opacity = 0.62 * fade;
    rig.flames.forEach((flame, index) => {
      const pulse = 0.86 + Math.sin(age * 25 + index * 1.9) * 0.14;
      flame.scale.set(0.72 + expansion * 0.28, (0.5 + (1 - progress) * 0.75) * pulse, 0.72 + expansion * 0.28);
      (flame.material as THREE.MeshBasicMaterial).opacity = 0.94 * fade;
    });
    rig.embers.forEach((ember, index) => {
      const angle = index * 2.399963;
      const distance = (18 + (index % 6) * 7) * expansion;
      ember.position.set(
        Math.cos(angle) * distance,
        8 + progress * (34 + (index % 5) * 8),
        Math.sin(angle) * distance
      );
      ember.scale.setScalar((1 - progress) * (0.72 + (index % 3) * 0.22));
      (ember.material as THREE.MeshBasicMaterial).opacity = 0.95 * fade;
    });
    rig.smoke.forEach((cloud, index) => {
      const angle = index * 2.399963 + 0.4;
      const distance = (12 + (index % 4) * 8) * expansion;
      cloud.position.set(
        Math.cos(angle) * distance,
        15 + progress * (28 + (index % 3) * 9),
        Math.sin(angle) * distance
      );
      cloud.scale.set(9 + progress * 15, 7 + progress * 13, 9 + progress * 15);
      (cloud.material as THREE.MeshStandardMaterial).opacity = 0.24 * fade;
    });
  }

  private removeMissing<T extends THREE.Object3D>(models: Map<number, T>, active: Set<number>): void {
    for (const [id, model] of models) {
      if (active.has(id)) continue;
      this.scene.remove(model);
      model.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          if (!Object.values(this.materials).includes(material as never)) material.dispose();
        }
      });
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
