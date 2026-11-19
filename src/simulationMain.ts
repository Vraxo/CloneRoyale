import { SimulationRuntime } from "./battle/simulationRuntime";

interface SimulationSummary {
  seed: number;
  winner: string | null;
  durationSeconds: number;
  phase: string;
  steps: number;
  crowns: { blue: number; red: number };
  towersRemaining: { blue: number; red: number };
  cardsPlayed: { blue: number; red: number };
  completed: boolean;
}

function countCrowns(state: SimulationRuntime["state"], side: "blue" | "red"): number {
  const enemyKing = state.towers.find((tower) => tower.side !== side && tower.kind === "king");
  if (enemyKing && enemyKing.hp <= 0) return 3;
  return state.towers.filter((tower) =>
    tower.side !== side && tower.kind === "princess" && tower.hp <= 0
  ).length;
}

function summarize(seed: number, runtime: SimulationRuntime, steps: number): SimulationSummary {
  const state = runtime.state;
  return {
    seed,
    winner: state.winner,
    durationSeconds: Number(state.time.toFixed(2)),
    phase: state.phase,
    steps,
    crowns: {
      blue: countCrowns(state, "blue"),
      red: countCrowns(state, "red")
    },
    towersRemaining: {
      blue: state.towers.filter((tower) => tower.side === "blue" && tower.hp > 0).length,
      red: state.towers.filter((tower) => tower.side === "red" && tower.hp > 0).length
    },
    cardsPlayed: {
      blue: state.sides.blue.cardsPlayed,
      red: state.sides.red.cardsPlayed
    },
    completed: state.gameOver
  };
}

export function runHeadlessSimulations(seed: number, matches: number): SimulationSummary[] {
  return Array.from({ length: matches }, (_, index) => {
    const matchSeed = (seed + index) >>> 0;
    const runtime = new SimulationRuntime(matchSeed);
    const steps = runtime.runToCompletion(null);
    return summarize(matchSeed, runtime, steps);
  });
}

const parameters = new URLSearchParams(window.location.search);
const seed = Number(parameters.get("seed") ?? Date.now()) >>> 0;
const matches = Math.max(1, Math.min(100, Number(parameters.get("matches") ?? 1) || 1));
const results = runHeadlessSimulations(seed, matches);
const completed = results.filter((result) => result.completed).length;
const output = {
  mode: "headless-simulation",
  matchesRequested: matches,
  matchesCompleted: completed,
  seed,
  results
};

document.body.replaceChildren();
document.body.style.cssText = "margin:0;padding:24px;background:#151918;color:#e5e5d7;font:14px ui-monospace,monospace";
const heading = document.createElement("h1");
heading.textContent = "CloneRoyale · Simulation results";
heading.style.cssText = "font:600 18px system-ui,sans-serif";
const summary = document.createElement("p");
summary.textContent = `${completed}/${matches} matches completed · seed ${seed}`;
const pre = document.createElement("pre");
pre.textContent = JSON.stringify(output, null, 2);
pre.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5";
document.body.append(heading, summary, pre);
