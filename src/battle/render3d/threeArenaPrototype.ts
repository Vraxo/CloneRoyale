import * as THREE from "three";

const FIELD_WIDTH = 540;
const FIELD_DEPTH = 960;
const LANE_X = [-165, 165];

const host = document.createElement("main");
host.className = "three-prototype";
host.innerHTML = `
  <header class="three-prototype-header">
    <a class="three-prototype-back" href="/">← Back</a>
    <div><span>CLONE ROYALE · RENDERER EXPERIMENT</span><strong>3D ARENA</strong></div>
    <span class="three-prototype-tag">THREE.JS</span>
  </header>
  <section class="three-prototype-stage" aria-label="Three-dimensional arena preview">
    <div class="three-prototype-board"></div>
  </section>
  <footer class="three-prototype-footer">
    <span>FIXED CAMERA</span><span>3D ENVIRONMENT · 2D GAMEPLAY COORDINATES</span><span>PROTOTYPE 01</span>
  </footer>
`;
document.body.append(host);

const stage = host.querySelector<HTMLDivElement>(".three-prototype-board");
if (!stage) throw new Error("Missing Three.js prototype stage");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#172c35");
scene.fog = new THREE.Fog("#172c35", 1250, 2300);

const camera = new THREE.PerspectiveCamera(34, 540 / 960, 1, 4000);
camera.position.set(0, 1180, 1160);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
stage.append(renderer.domElement);

scene.add(new THREE.HemisphereLight("#dcecff", "#56613e", 2.0));

const sunlight = new THREE.DirectionalLight("#fff0d2", 3.2);
sunlight.position.set(-430, 850, 500);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
sunlight.shadow.camera.left = -430;
sunlight.shadow.camera.right = 430;
sunlight.shadow.camera.top = 620;
sunlight.shadow.camera.bottom = -620;
sunlight.shadow.normalBias = 0.035;
scene.add(sunlight);

const fillLight = new THREE.DirectionalLight("#9ac9ff", 1.05);
fillLight.position.set(420, 380, -520);
scene.add(fillLight);

const materials = {
  grass: new THREE.MeshStandardMaterial({ color: "#739354", roughness: 1 }),
  grassLight: new THREE.MeshStandardMaterial({ color: "#88a75f", roughness: 1 }),
  grassDark: new THREE.MeshStandardMaterial({ color: "#5d7d49", roughness: 1 }),
  earth: new THREE.MeshStandardMaterial({ color: "#6d5940", roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: "#a99a78", roughness: 0.92 }),
  stoneLight: new THREE.MeshStandardMaterial({ color: "#c7b994", roughness: 0.85 }),
  stoneDark: new THREE.MeshStandardMaterial({ color: "#625b49", roughness: 1 }),
  water: new THREE.MeshStandardMaterial({ color: "#398d9b", roughness: 0.28, metalness: 0.08 }),
  waterLight: new THREE.MeshStandardMaterial({ color: "#76c4c0", roughness: 0.32, transparent: true, opacity: 0.62 }),
  wood: new THREE.MeshStandardMaterial({ color: "#89633d", roughness: 0.9 }),
  woodLight: new THREE.MeshStandardMaterial({ color: "#bd9160", roughness: 0.82 }),
  blue: new THREE.MeshStandardMaterial({ color: "#438bc4", roughness: 0.68 }),
  blueLight: new THREE.MeshStandardMaterial({ color: "#79b8df", roughness: 0.6 }),
  red: new THREE.MeshStandardMaterial({ color: "#c85e50", roughness: 0.68 }),
  redLight: new THREE.MeshStandardMaterial({ color: "#e58a70", roughness: 0.6 }),
  roof: new THREE.MeshStandardMaterial({ color: "#536c69", roughness: 0.8 }),
  gold: new THREE.MeshStandardMaterial({ color: "#e6c477", metalness: 0.32, roughness: 0.42 })
};

function addMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  parent: THREE.Object3D = scene
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function box(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  parent: THREE.Object3D = scene
): THREE.Mesh {
  return addMesh(new THREE.BoxGeometry(width, height, depth), material, x, y, z, parent);
}

function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  segments = 12,
  parent: THREE.Object3D = scene
): THREE.Mesh {
  return addMesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material, x, y, z, parent
  );
}

function createArena(): void {
  box(610, 34, 1030, materials.earth, 0, -32, 0);
  box(580, 18, 1000, materials.stoneDark, 0, -9, 0);
  box(FIELD_WIDTH, 8, FIELD_DEPTH, materials.grass, 0, 0, 0);

  for (let row = 0; row < 28; row += 1) {
    for (let column = 0; column < 16; column += 1) {
      const seed = (row * 31 + column * 17) % 13;
      if (seed < 5) continue;
      const x = -250 + column * 33 + (row % 2) * 13;
      const z = -460 + row * 34;
      const radius = 2.5 + (seed % 4);
      const tuft = addMesh(
        new THREE.SphereGeometry(radius, 5, 4),
        seed % 3 === 0 ? materials.grassDark : materials.grassLight,
        x, 3, z
      );
      tuft.scale.set(1.3, 0.34, 0.8);
      tuft.castShadow = false;
    }
  }

  // Worn stone lanes lead from each tower line to the river crossings.
  for (const laneX of LANE_X) {
    box(82, 2, 390, materials.earth, laneX, 5, -285);
    box(82, 2, 390, materials.earth, laneX, 5, 285);
    for (let index = 0; index < 15; index += 1) {
      const z = -455 + index * 25;
      if (Math.abs(z) < 75) continue;
      box(70, 2, 19, index % 2 ? materials.stone : materials.stoneLight, laneX, 7, z);
    }
  }

  // River bank, shallow water, and sculpted banks.
  box(580, 15, 116, materials.earth, 0, -1, 0);
  box(570, 5, 100, materials.water, 0, 7, 0);
  for (let index = 0; index < 17; index += 1) {
    const x = -260 + index * 32;
    const ripple = box(17 + (index % 3) * 8, 0.8, 2.2, materials.waterLight, x, 10, (index % 4 - 1.5) * 19);
    ripple.rotation.y = -0.13;
    ripple.castShadow = false;
  }
  box(580, 8, 16, materials.stoneDark, 0, 5, -58);
  box(580, 8, 16, materials.stoneDark, 0, 5, 58);

  for (const x of LANE_X) createBridge(x);
  createBankDecorations();
}

function createBridge(x: number): void {
  const bridge = new THREE.Group();
  bridge.position.set(x, 0, 0);
  scene.add(bridge);

  box(100, 12, 142, materials.wood, 0, 13, 0, bridge);
  box(92, 4, 132, materials.woodLight, 0, 21, 0, bridge);

  for (let index = 0; index < 10; index += 1) {
    box(88, 2, 11, materials.wood, 0, 24, -59 + index * 13, bridge);
  }

  for (const side of [-1, 1]) {
    box(8, 13, 142, materials.wood, side * 48, 28, 0, bridge);
    for (let post = 0; post < 5; post += 1) {
      cylinder(4, 4, 30, materials.woodLight, side * 48, 36, -55 + post * 27, 8, bridge);
    }
  }
}

function createBankDecorations(): void {
  for (const side of [-1, 1]) {
    for (let index = 0; index < 7; index += 1) {
      const x = side * (250 + (index % 2) * 10);
      const z = -390 + index * 125;
      const shrub = addMesh(
        new THREE.IcosahedronGeometry(13 + (index % 3) * 3, 1),
        index % 2 ? materials.grassDark : materials.grassLight,
        x, 13, z
      );
      shrub.scale.y = 0.72;
    }
  }

  for (const x of [-275, 275]) {
    box(18, 34, 18, materials.stoneDark, x, 17, 0);
    box(25, 8, 25, materials.stone, x, 38, 0);
  }
}

function createTower(x: number, z: number, team: "blue" | "red", king = false): void {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  scene.add(group);

  const scale = king ? 1.23 : 1;
  const teamMaterial = team === "blue" ? materials.blue : materials.red;
  const trimMaterial = team === "blue" ? materials.blueLight : materials.redLight;
  const baseRadius = king ? 43 : 34;
  const bodyWidth = king ? 67 : 54;
  const bodyHeight = king ? 76 : 62;

  cylinder(baseRadius, baseRadius + 7, 15, materials.stoneDark, 0, 8, 0, 12, group);
  cylinder(baseRadius - 3, baseRadius, 9, materials.stoneLight, 0, 18, 0, 12, group);
  box(bodyWidth, bodyHeight, bodyWidth, materials.stone, 0, 15 + bodyHeight / 2, 0, group);
  box(bodyWidth + 5, 8, bodyWidth + 5, teamMaterial, 0, bodyHeight + 15, 0, group);
  box(bodyWidth - 9, 5, bodyWidth - 9, trimMaterial, 0, bodyHeight + 21, 0, group);

  const turretY = bodyHeight + 25;
  cylinder(king ? 31 : 25, king ? 35 : 29, 27 * scale, teamMaterial, 0, turretY + 13, 0, 10, group);
  cylinder(king ? 34 : 28, king ? 34 : 28, 8, materials.stoneLight, 0, turretY + 29, 0, 10, group);
  const roof = addMesh(
    new THREE.ConeGeometry(king ? 36 : 30, king ? 42 : 35, 8),
    materials.roof,
    0, turretY + 52 * scale, 0,
    group
  );
  roof.rotation.y = Math.PI / 8;

  for (let index = 0; index < 4; index += 1) {
    const angle = Math.PI / 4 + index * Math.PI / 2;
    const px = Math.cos(angle) * (king ? 38 : 31);
    const pz = Math.sin(angle) * (king ? 38 : 31);
    box(13, 20, 13, materials.stoneLight, px, bodyHeight + 23, pz, group);
  }

  // Front-facing arched-looking window and gold crest.
  box(13, 22, 3, materials.stoneDark, 0, 39, bodyWidth / 2 + 1.8, group);
  box(7, 13, 2, materials.gold, 0, 40, bodyWidth / 2 + 3.6, group);

  const flagPole = cylinder(1.8, 1.8, 48, materials.gold, bodyWidth / 2 + 4, bodyHeight + 50, 0, 6, group);
  flagPole.castShadow = false;
  const flag = box(24, 16, 2, teamMaterial, bodyWidth / 2 + 15, bodyHeight + 62, 0, group);
  flag.rotation.z = -0.12;

  if (king) {
    cylinder(7, 7, 8, materials.gold, 0, turretY + 76, 0, 8, group);
  }
}

function createArenaDetails(): void {
  for (const side of ["blue", "red"] as const) {
    const z = side === "blue" ? 1 : -1;
    createTower(-165, z * 280, side);
    createTower(165, z * 280, side);
    createTower(0, z * 420, side, true);
  }

  // Small stone posts mark the two river crossings.
  for (const x of LANE_X) {
    for (const z of [-72, 72]) {
      cylinder(8, 10, 18, materials.stoneDark, x - 57, 10, z, 8);
      cylinder(8, 10, 18, materials.stoneDark, x + 57, 10, z, 8);
    }
  }
}

createArena();
createArenaDetails();

const resize = (): void => {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  if (width <= 0 || height <= 0) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.fov = 34;
  camera.updateProjectionMatrix();
};

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(stage);
resize();

let frame = 0;
const clock = new THREE.Clock();
const animate = (): void => {
  frame = requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();
  // A subtle water shimmer gives the static arena a little life.
  const water = materials.waterLight;
  water.opacity = 0.48 + Math.sin(elapsed * 1.25) * 0.08;
  renderer.render(scene, camera);
};
animate();

window.addEventListener("pagehide", () => {
  cancelAnimationFrame(frame);
  resizeObserver.disconnect();
  renderer.dispose();
  scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach(item => item.dispose());
      else material.dispose();
    }
  });
  host.remove();
}, { once: true });
